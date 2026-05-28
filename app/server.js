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

function normalizeStatus(status = '') {
  const value = String(status).toLowerCase();
  if (value.includes('process')) return 'processed';
  if (value.includes('valid') || value.includes('accept') || value.includes('success')) return 'validated';
  if (value.includes('fail') || value.includes('reject') || value.includes('error')) return 'failed';
  return 'pending';
}

function formatStatus(status = '') {
  const normalized = normalizeStatus(status);
  if (normalized === 'processed') return 'Processed';
  if (normalized === 'validated') return 'Validated';
  if (normalized === 'failed') return 'Failed';
  return 'Pending';
}

function formatDate(value = '') {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function getDocumentData() {
  const files = fs.existsSync(EFS_BASE) ? fs.readdirSync(EFS_BASE) : [];
  let metadata = [];
  let metadataError = '';

  try {
    const out = await ddb.send(new ScanCommand({ TableName: TABLE }));
    metadata = out.Items || [];
  } catch (e) {
    metadataError = e.message;
  }

  return { files, metadata, metadataError };
}

function getDocumentTitle(item = {}) {
  return item.documentTitle || item.title || item.documentName || item.fileName || 'Untitled document';
}

function getDocumentFileName(item = {}) {
  return item.documentName || item.fileName || getDocumentTitle(item);
}

function getStats(metadata = [], files = []) {
  const totalDocuments = Math.max(metadata.length, files.length);
  const pending = metadata.filter((item) => normalizeStatus(item.validationStatus) === 'pending').length;
  const validated = metadata.filter((item) => {
    const status = normalizeStatus(item.validationStatus);
    return status === 'validated' || status === 'processed';
  }).length;
  const failed = metadata.filter((item) => normalizeStatus(item.validationStatus) === 'failed').length;
  const suppliers = new Set(metadata.map((item) => item.supplier).filter(Boolean)).size;
  const readiness = totalDocuments ? Math.round((validated / totalDocuments) * 100) : 0;

  return { totalDocuments, pending, validated, failed, suppliers, readiness };
}

function renderBadge(status = '') {
  const normalized = normalizeStatus(status);
  return `<span class="badge ${normalized}">${formatStatus(status)}</span>`;
}

function renderTechnicalEvidence() {
  return `<section class="technical-evidence">
    <div class="section-heading compact">
      <p class="eyebrow dark">Trainer evidence</p>
      <h2>W5 Technical Evidence</h2>
    </div>
    <div class="evidence-grid">
      <span><strong>Application Load Balancer</strong> Active</span>
      <span><strong>Container Service</strong> Running</span>
      <span><strong>Shared File Storage</strong> Connected</span>
      <span><strong>Metadata Store</strong> Available</span>
      <span><strong>Validation API</strong> Ready</span>
    </div>
  </section>`;
}

function layout(title, body, active = '') {
  const nav = [
    ['/', 'Dashboard'],
    ['/upload-form', 'Upload Document'],
    ['/documents', 'Repository'],
    ['/lambda-test', 'Validation Center'],
    ['/health', 'System Status']
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
        <p class="eyebrow">Supplier quality operations</p>
        <h1>Agri Compliance Portal</h1>
      </div>
      <nav>${nav}</nav>
    </header>
    <main>${body}</main>
  </body>
</html>`;
}

function renderDocumentTable(metadata = []) {
  if (!metadata.length) {
    return `<div class="empty-state">
      <h3>No documents registered yet</h3>
      <p>Upload a supplier certificate or inspection report to start building the compliance repository.</p>
      <a class="button primary" href="/upload-form">Upload first document</a>
    </div>`;
  }

  const rows = metadata.map((item) => {
    const fileName = getDocumentFileName(item);
    return `<tr>
      <td>
        <strong>${escapeHtml(getDocumentTitle(item))}</strong>
        <span>${escapeHtml(fileName)}</span>
      </td>
      <td>${escapeHtml(item.supplier || 'Unknown supplier')}</td>
      <td>${escapeHtml(item.documentType || 'General document')}</td>
      <td>${escapeHtml(formatDate(item.uploadTime))}</td>
      <td>${renderBadge(item.validationStatus)}</td>
      <td><a class="text-link" href="/lambda-test">Validate</a></td>
    </tr>`;
  }).join('');

  return `<div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Document name</th>
          <th>Supplier</th>
          <th>Type</th>
          <th>Upload time</th>
          <th>Validation status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ---- Health ----
app.get('/health', async (req, res) => {
  if (!wantsHtml(req)) {
    return res.json({ status: 'ok', time: new Date().toISOString() });
  }

  const storageReady = fs.existsSync(EFS_BASE);
  const { metadataError } = await getDocumentData();
  const validationReady = Boolean(API_GW_URL);

  res.send(layout('System Status', `
    <section class="page-header">
      <div>
        <p class="eyebrow dark">System Status</p>
        <h2>Operational readiness for document teams.</h2>
        <p>Monitor the portal components that support intake, repository access, and validation workflows.</p>
      </div>
    </section>
    <section class="status-grid">
      <article class="status-card online"><span></span><strong>Portal status</strong><p>Online</p></article>
      <article class="status-card ${storageReady ? 'online' : 'warning'}"><span></span><strong>Storage status</strong><p>${storageReady ? 'Available' : 'Needs attention'}</p></article>
      <article class="status-card ${metadataError ? 'warning' : 'online'}"><span></span><strong>Metadata status</strong><p>${metadataError ? 'Limited' : 'Available'}</p></article>
      <article class="status-card ${validationReady ? 'online' : 'warning'}"><span></span><strong>Validation status</strong><p>${validationReady ? 'Ready' : 'Not configured'}</p></article>
    </section>
    ${renderTechnicalEvidence()}
  `, '/health'));
});

// ---- Dashboard ----
app.get('/', async (req, res) => {
  const { files, metadata, metadataError } = await getDocumentData();
  const stats = getStats(metadata, files);
  const recent = metadata
    .slice()
    .sort((a, b) => new Date(b.uploadTime || 0) - new Date(a.uploadTime || 0))
    .slice(0, 5);
  const recentRows = recent.length
    ? recent.map((item) => `<li>
        <div><strong>${escapeHtml(getDocumentTitle(item))}</strong><span>${escapeHtml(item.supplier || 'Unknown supplier')}</span></div>
        ${renderBadge(item.validationStatus)}
      </li>`).join('')
    : `<li class="muted-row">No recent uploads yet.</li>`;

  res.send(layout('Dashboard', `
    <section class="hero">
      <div>
        <p class="eyebrow dark">Quality control workspace</p>
        <h2>Manage supplier compliance documents in one secure portal.</h2>
        <p>Register certificates, track validation status, and keep supplier documentation ready for audits and shipment reviews.</p>
        <div class="action-row">
          <a class="button primary" href="/upload-form">Upload & Register Document</a>
          <a class="button secondary" href="/documents">View repository</a>
        </div>
      </div>
      <aside class="readiness-card">
        <span>${stats.readiness}%</span>
        <strong>Compliance Readiness</strong>
        <p>${stats.validated} validated of ${stats.totalDocuments} registered documents.</p>
      </aside>
    </section>
    <section class="kpi-grid">
      <article><span>Total Documents</span><strong>${stats.totalDocuments}</strong><p>Registered supplier files</p></article>
      <article><span>Pending Validation</span><strong>${stats.pending}</strong><p>Waiting for review</p></article>
      <article><span>Validated Documents</span><strong>${stats.validated}</strong><p>Ready for audit evidence</p></article>
      <article><span>Suppliers</span><strong>${stats.suppliers}</strong><p>With active records</p></article>
      <article><span>Recent Uploads</span><strong>${recent.length}</strong><p>Latest repository activity</p></article>
      <article><span>Compliance Readiness</span><strong>${stats.readiness}%</strong><p>Validated document ratio</p></article>
    </section>
    <section class="content-grid">
      <article class="panel">
        <div class="section-heading compact">
          <p class="eyebrow dark">Recent Uploads</p>
          <h2>Latest supplier documents</h2>
        </div>
        ${metadataError ? `<p class="notice">Metadata is temporarily limited: ${escapeHtml(metadataError)}</p>` : ''}
        <ul class="recent-list">${recentRows}</ul>
      </article>
      <article class="panel">
        <div class="section-heading compact">
          <p class="eyebrow dark">Next actions</p>
          <h2>Quality-control queue</h2>
        </div>
        <div class="task-list">
          <span><strong>${stats.pending}</strong> documents need validation.</span>
          <span><strong>${stats.failed}</strong> documents require follow-up.</span>
          <span><strong>${stats.suppliers}</strong> suppliers have active records.</span>
        </div>
      </article>
    </section>
    ${renderTechnicalEvidence()}
  `, '/'));
});

function renderUploadPage() {
  return layout('Upload Document', `
    <section class="page-header">
      <div>
        <p class="eyebrow dark">Document intake</p>
        <h2>Register a supplier compliance document.</h2>
        <p>Capture the document details quality-control teams need before validation and audit review.</p>
      </div>
    </section>
    <section class="panel narrow">
      <div class="section-heading">
        <p class="eyebrow dark">New document</p>
        <h2>Document details</h2>
      </div>
      <form method="POST" action="/upload" enctype="multipart/form-data">
        <label>
          Supplier name
          <input type="text" name="supplier" placeholder="Example: Mekong Farm Cooperative" required>
        </label>
        <label>
          Document type
          <select name="documentType" required>
            <option>VietGAP Certificate</option>
            <option>GlobalGAP Certificate</option>
            <option>Organic Certificate</option>
            <option>Phytosanitary Certificate</option>
            <option>Invoice</option>
            <option>Inspection Report</option>
          </select>
        </label>
        <label>
          Document title
          <input type="text" name="documentTitle" placeholder="Example: 2026 VietGAP renewal certificate">
        </label>
        <label>
          File upload
          <input type="file" name="file" required>
        </label>
        <label>
          Notes
          <textarea name="notes" rows="4" placeholder="Optional intake notes for the quality-control team"></textarea>
        </label>
        <button class="button primary" type="submit">Upload & Register Document</button>
      </form>
    </section>
  `, '/upload-form');
}

app.get('/upload-form', (req, res) => {
  res.send(renderUploadPage());
});

app.get('/upload', (req, res) => {
  res.send(renderUploadPage());
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
      documentTitle:    req.body.documentTitle || req.file.originalname,
      supplier:         req.body.supplier  || 'unknown',
      documentType:    req.body.documentType || 'unknown',
      notes:            req.body.notes || '',
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
            <h2>Document registered successfully</h2>
            <p>${escapeHtml(getDocumentTitle(item))} has been added to the repository and is ready for validation.</p>
          </div>
          <div class="summary-card">
            <dl>
              <dt>Supplier</dt><dd>${escapeHtml(item.supplier)}</dd>
              <dt>Type</dt><dd>${escapeHtml(item.documentType)}</dd>
              <dt>Status</dt><dd>${renderBadge(item.validationStatus)}</dd>
            </dl>
          </div>
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
  const { files, metadata, metadataError } = await getDocumentData();

  if (!wantsHtml(req)) {
    return res.json({ filesOnEfs: files, metadata, metadataError });
  }

  res.send(layout('Document Repository', `
    <section class="page-header">
      <div>
        <p class="eyebrow dark">Repository</p>
        <h2>Supplier document repository.</h2>
        <p>Review registered compliance documents, validation status, and supplier ownership.</p>
      </div>
      <a class="button primary" href="/upload-form">Upload document</a>
    </section>
    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow dark">Documents</p>
          <h2>Compliance records</h2>
        </div>
        <span class="table-count">${metadata.length} records</span>
      </div>
      ${metadataError ? `<p class="notice">Metadata records are temporarily unavailable: ${escapeHtml(metadataError)}</p>` : ''}
      ${renderDocumentTable(metadata)}
    </section>
  `, '/documents'));
});

app.get('/files', async (req, res) => {
  const { files, metadata, metadataError } = await getDocumentData();
  if (!wantsHtml(req)) {
    return res.json({ filesOnEfs: files, metadata, metadataError });
  }
  return res.redirect('/documents');
});

app.get('/files/:name', (req, res) => {
  const requestedName = path.basename(req.params.name);
  const filePath = path.join(EFS_BASE, requestedName);
  if (!filePath.startsWith(EFS_BASE) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  return res.sendFile(filePath);
});

async function callValidationService() {
  if (!API_GW_URL) {
    return {
      status: 503,
      ok: false,
      businessStatus: 'Validation service not configured',
      body: { message: 'Validation endpoint is not configured.' },
      raw: ''
    };
  }

  const r = await fetch(API_GW_URL, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ check: 'document-validation', at: Date.now() })
  });
  const text = await r.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch (_err) {
    body = text;
  }

  return {
    status: r.status,
    ok: r.ok,
    businessStatus: r.ok ? 'Validation service available' : 'Validation service needs attention',
    body,
    raw: text
  };
}

function renderValidationPage(result = null) {
  const resultBlock = result ? `<section class="panel">
    <div class="section-heading compact">
      <p class="eyebrow dark">Validation result</p>
      <h2>${escapeHtml(result.businessStatus)}</h2>
    </div>
    <div class="validation-grid">
      <article class="${result.ok ? 'online' : 'warning'}"><span></span><strong>Validation service</strong><p>${result.ok ? 'Available' : 'Needs attention'}</p></article>
      <article class="${result.ok ? 'online' : 'warning'}"><span></span><strong>Document metadata</strong><p>${result.ok ? 'Checked' : 'Not completed'}</p></article>
      <article><strong>Last validation response</strong><p>${escapeHtml(typeof result.body === 'object' ? (result.body.message || result.body.validationStatus || 'Response received') : result.body)}</p></article>
    </div>
    <details>
      <summary>Technical details</summary>
      <pre>${escapeHtml(result.raw || JSON.stringify(result.body, null, 2))}</pre>
    </details>
  </section>` : '';

  return layout('Document Validation Center', `
    <section class="page-header">
      <div>
        <p class="eyebrow dark">Document Validation Center</p>
        <h2>Run a validation check for registered documents.</h2>
        <p>Confirm that the validation service is ready before quality-control teams mark documents as reviewed.</p>
      </div>
      <form class="inline-form" method="GET" action="/lambda-test">
        <input type="hidden" name="run" value="1">
        <button class="button primary" type="submit">Run validation check</button>
      </form>
    </section>
    ${resultBlock || `<section class="panel empty-state">
      <h3>No validation run in this session</h3>
      <p>Use the button above to check service availability and document metadata readiness.</p>
    </section>`}
  `, '/lambda-test');
}

// ---- Validation via API Gateway ----
app.get('/lambda-test', async (req, res) => {
  try {
    if (wantsHtml(req)) {
      const result = req.query.run ? await callValidationService() : null;
      return res.status(result ? result.status : 200).send(renderValidationPage(result));
    }
    const result = await callValidationService();
    res.status(result.status).json({ via: 'api-gateway', status: result.status, body: result.raw });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/lambda-test', async (req, res) => {
  try {
    const result = await callValidationService();
    if (wantsHtml(req)) {
      return res.status(result.status).send(renderValidationPage(result));
    }
    return res.status(result.status).json({ via: 'api-gateway', status: result.status, body: result.raw });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log('Server on :' + PORT));
