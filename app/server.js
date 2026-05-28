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
const PORT = process.env.PORT || 3000;

const EFS_BASE     = process.env.EFS_BASE || process.env.EFS_UPLOAD_DIR || '/mnt/efs/uploads';
const REGION       = process.env.AWS_REGION   || 'us-east-1';
const TABLE        = process.env.DDB_TABLE    || 'w5-agri-documents';
const API_GW_URL   = process.env.API_GW_URL   || '';
const API_KEY      = process.env.API_KEY      || '';

if (!fs.existsSync(EFS_BASE)) fs.mkdirSync(EFS_BASE, { recursive: true });

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const upload = multer({ dest: EFS_BASE });

app.use(express.static('public'));
app.use(express.json());

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wantsHtml(req) {
  const accept = req.get('accept') || '';
  return accept.includes('text/html') && !accept.includes('application/json');
}

function layout(title, body, active = '') {
  const nav = [
    ['/', 'Dashboard'],
    ['/upload-form', 'Upload'],
    ['/documents', 'Repository'],
    ['/lambda-test', 'Validation'],
    ['/health', 'Health']
  ].map(([href, label]) => (
    `<a class="${active === href ? 'active' : ''}" href="${href}">${label}</a>`
  )).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | W5 Agri Portal</title>
    <link rel="stylesheet" href="/style.css">
  </head>
  <body>
    <header class="topbar">
      <div>
        <p class="eyebrow">W5 Network Fortress</p>
        <h1>Agri Compliance Portal</h1>
      </div>
      <nav>${nav}</nav>
    </header>
    <main>${body}</main>
  </body>
</html>`;
}

function renderDocumentCard(item) {
  return `<article class="document-card">
    <div class="document-card__title">
      <h3>${escapeHtml(item.documentName || item.fileName || 'Unnamed document')}</h3>
      <span>${escapeHtml(item.validationStatus || 'pending')}</span>
    </div>
    <dl>
      <dt>Supplier</dt><dd>${escapeHtml(item.supplier || 'unknown')}</dd>
      <dt>Type</dt><dd>${escapeHtml(item.documentType || 'unknown')}</dd>
      <dt>Uploaded</dt><dd>${escapeHtml(item.uploadTime || 'n/a')}</dd>
      <dt>EFS path</dt><dd>${escapeHtml(item.efsPath || 'n/a')}</dd>
    </dl>
  </article>`;
}

// ---- Health ----
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---- Dashboard ----
app.get('/', (req, res) => {
  res.send(layout('Dashboard', `
    <section class="hero">
      <div>
        <p class="eyebrow dark">Smart agricultural compliance</p>
        <h2>Document intake, storage evidence, and validation status in one place.</h2>
        <p>Use this portal to upload supplier certificates, verify shared EFS storage, read DynamoDB metadata, and call the API Gateway backed validation Lambda.</p>
        <div class="action-row">
          <a class="button primary" href="/upload-form">Upload document</a>
          <a class="button secondary" href="/documents">View repository</a>
        </div>
      </div>
      <aside class="health-card">
        <span class="status-dot"></span>
        <strong>Live on ECS Fargate</strong>
        <p>Public traffic enters through the W5 Application Load Balancer and forwards to the private app service.</p>
      </aside>
    </section>
    <section>
      <div class="section-heading">
        <p class="eyebrow dark">Architecture checks</p>
        <h2>W5 service surface</h2>
      </div>
      <div class="metric-grid">
        <article><span>01</span><strong>ALB</strong><p>Internet-facing entrypoint for the web portal.</p></article>
        <article><span>02</span><strong>ECS Fargate</strong><p>Containerized Node.js app running the document workflow.</p></article>
        <article><span>03</span><strong>EFS</strong><p>Shared upload path mounted at ${escapeHtml(EFS_BASE)}.</p></article>
        <article><span>04</span><strong>DynamoDB</strong><p>Metadata table for uploaded compliance documents.</p></article>
        <article><span>05</span><strong>API Gateway</strong><p>Managed validation endpoint in front of Lambda.</p></article>
        <article><span>06</span><strong>Lambda</strong><p>Serverless validation response for W5 evidence.</p></article>
      </div>
    </section>
  `, '/'));
});

app.get('/upload-form', (req, res) => {
  res.send(layout('Upload Document', `
    <section class="panel narrow">
      <div class="section-heading">
        <p class="eyebrow dark">Document intake</p>
        <h2>Upload agricultural compliance evidence</h2>
      </div>
      <form method="POST" action="/upload" enctype="multipart/form-data">
        <label>
          File
          <input type="file" name="file" required>
        </label>
        <label>
          Supplier
          <input type="text" name="supplier" placeholder="Example: Mekong Farm Cooperative" required>
        </label>
        <label>
          Type
          <select name="documentType">
            <option>VietGAP</option>
            <option>GlobalGAP</option>
            <option>Organic</option>
            <option>Phytosanitary</option>
          </select>
        </label>
        <button class="button primary" type="submit">Upload to EFS</button>
      </form>
    </section>
  `, '/upload-form'));
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
    if (wantsHtml(req)) {
      return res.send(layout('Upload Complete', `
        <section class="panel narrow">
          <div class="success-block">
            <span class="status-dot"></span>
            <h2>Document uploaded</h2>
            <p>${escapeHtml(item.documentName)} was saved to EFS and metadata was written to DynamoDB.</p>
          </div>
          ${renderDocumentCard(item)}
          <div class="action-row">
            <a class="button primary" href="/documents">Open repository</a>
            <a class="button secondary" href="/upload-form">Upload another</a>
          </div>
        </section>
      `, '/upload-form'));
    }
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- List documents (read from EFS) ----
app.get('/documents', async (req, res) => {
  const files = fs.existsSync(EFS_BASE) ? fs.readdirSync(EFS_BASE) : [];
  let metadata = [];
  let metadataError = '';

  try {
    const out = await ddb.send(new ScanCommand({ TableName: TABLE }));
    metadata = out.Items || [];
  } catch (e) {
    metadataError = e.message;
  }

  if (!wantsHtml(req)) {
    return res.json({ filesOnEfs: files, metadata, metadataError });
  }

  const cards = metadata.length
    ? metadata.map(renderDocumentCard).join('')
    : `<div class="empty-state">
        <h3>No metadata records yet</h3>
        <p>Upload a document to create a DynamoDB record and write the file to EFS.</p>
      </div>`;

  res.send(layout('Document Repository', `
    <section>
      <div class="section-heading">
        <p class="eyebrow dark">Repository</p>
        <h2>Compliance documents</h2>
      </div>
      ${metadataError ? `<p class="notice">DynamoDB metadata unavailable: ${escapeHtml(metadataError)}</p>` : ''}
      <div class="repository-grid">${cards}</div>
    </section>
    <section class="panel">
      <div class="section-heading compact">
        <p class="eyebrow dark">EFS files</p>
        <h2>Files on shared storage</h2>
      </div>
      <pre>${escapeHtml(JSON.stringify(files, null, 2))}</pre>
    </section>
  `, '/documents'));
});

// ---- Validation via API Gateway ----
app.get('/lambda-test', async (req, res) => {
  if (!API_GW_URL) {
    if (wantsHtml(req)) {
      return res.status(500).send(layout('Validation Service', `
        <section class="panel narrow">
          <h2>Validation service is not configured</h2>
          <p class="notice">API_GW_URL is missing from the ECS task environment.</p>
        </section>
      `, '/lambda-test'));
    }
    return res.status(500).json({ error: 'API_GW_URL not set' });
  }
  try {
    const r = await fetch(API_GW_URL, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ check: 'document-validation', at: Date.now() })
    });
    const text = await r.text();
    if (wantsHtml(req)) {
      return res.status(r.status).send(layout('Validation Service', `
        <section class="panel">
          <div class="section-heading">
            <p class="eyebrow dark">API Gateway</p>
            <h2>Validation service response</h2>
          </div>
          <div class="response-summary">
            <strong>HTTP ${r.status}</strong>
            <span>via API Gateway</span>
          </div>
          <pre>${escapeHtml(text)}</pre>
        </section>
      `, '/lambda-test'));
    }
    res.status(r.status).json({ via: 'api-gateway', status: r.status, body: text });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.listen(PORT, () => console.log('Server on :' + PORT));
