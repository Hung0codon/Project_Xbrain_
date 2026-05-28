const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } =
  require('@aws-sdk/lib-dynamodb');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

const EFS_BASE     = '/mnt/efs/uploads';
const REGION       = process.env.AWS_REGION   || 'us-east-1';
const TABLE        = process.env.DDB_TABLE    || 'w5-agri-documents';
const API_GW_URL   = process.env.API_GW_URL   || '';
const API_KEY      = process.env.API_KEY      || '';

if (!fs.existsSync(EFS_BASE)) fs.mkdirSync(EFS_BASE, { recursive: true });

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const upload = multer({ dest: EFS_BASE });

app.use(express.static('public'));
app.use(express.json());

// ---- Health ----
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---- Dashboard ----
app.get('/', (req, res) => {
  res.send(`<h1>Agri Compliance Dashboard</h1>
  <ul>
    <li><a href="/upload-form">Upload Document</a></li>
    <li><a href="/documents">Document Repository</a></li>
    <li><a href="/lambda-test">Validation Service</a></li>
    <li><a href="/health">Health</a></li>
  </ul>`);
});

app.get('/upload-form', (req, res) => {
  res.send(`<form method="POST" action="/upload" enctype="multipart/form-data">
    File: <input type="file" name="file" required><br>
    Supplier: <input type="text" name="supplier" required><br>
    Type: <select name="documentType">
      <option>VietGAP</option><option>GlobalGAP</option>
      <option>Organic</option><option>Phytosanitary</option>
    </select><br>
    <button type="submit">Upload</button>
  </form>`);
});

// ---- Upload ----
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const documentId = uuidv4();
    const finalPath  = path.join(EFS_BASE, `${documentId}-${req.file.originalname}`);
    fs.renameSync(req.file.path, finalPath);

    const item = {
      documentId,
      documentName:     req.file.originalname,
      supplier:         req.body.supplier  || 'unknown',
      documentType:    req.body.documentType || 'unknown',
      uploadTime:       new Date().toISOString(),
      validationStatus: 'pending',
      efsPath:          finalPath
    };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- List documents (read from EFS) ----
app.get('/documents', async (req, res) => {
  const files = fs.readdirSync(EFS_BASE);
  const out = await ddb.send(new ScanCommand({ TableName: TABLE }));
  res.json({ filesOnEfs: files, metadata: out.Items });
});

// ---- Validation via API Gateway ----
app.get('/lambda-test', async (req, res) => {
  if (!API_GW_URL) return res.status(500).json({ error: 'API_GW_URL not set' });
  try {
    const r = await fetch(API_GW_URL, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ check: 'document-validation', at: Date.now() })
    });
    const text = await r.text();
    res.status(r.status).json({ via: 'api-gateway', status: r.status, body: text });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.listen(PORT, () => console.log('Server on :' + PORT));
