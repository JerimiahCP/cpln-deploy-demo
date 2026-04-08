'use strict';

// ── Utilities ────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const app = $('app');

function toast(msg, duration = 2500) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

function formatBytes(n) {
  if (n < 1024)        return n + ' B';
  if (n < 1024 ** 2)   return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 ** 2).toFixed(1) + ' MB';
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(iso));
}

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body;
  }
  const res = await fetch(path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'));
}

// ── Info bar ─────────────────────────────────────────────────────────────────

let infoData = null;

async function loadInfo() {
  try {
    infoData = await api('GET', '/api/info');

    // Update env badge
    const badge = $('env-badge');
    if (badge) {
      badge.textContent = infoData.environment;
      badge.className = 'badge ' + (
        infoData.environment === 'prod' || infoData.environment === 'production' ? 'badge-prod' :
        infoData.environment === 'staging' ? 'badge-stage' : 'badge-env'
      );
    }
  } catch (e) { /* non-fatal */ }
}

function renderInfoBar() {
  if (!infoData) return '';
  const items = [
    ['Version',     infoData.version === 'local' ? 'local-dev' : infoData.version.slice(0, 10)],
    ['Cloud',       infoData.cloud],
    ['Location',    infoData.location || '—'],
    ['GVC',         infoData.gvc],
    ['Storage',     infoData.storage.configured ? `S3 · ${infoData.storage.bucket}` : 'S3 · not configured'],
  ];
  return `<div class="info-bar container">
    ${items.map(([label, val]) => `
      <div class="info-item">
        <span class="info-label">${label}</span>
        <span class="info-value">${val}</span>
      </div>`).join('')}
  </div>`;
}

function storageWarning() {
  if (infoData && !infoData.storage.configured) {
    return `<div class="storage-warning">
      <strong>S3 not configured</strong>
      Set <code>AWS_S3_BUCKET</code>, <code>AWS_ACCESS_KEY_ID</code>, and <code>AWS_SECRET_ACCESS_KEY</code>
      to enable file and note persistence. On Control Plane these are injected via secrets — never in the image.
    </div>`;
  }
  return '';
}

// ── Home view ─────────────────────────────────────────────────────────────────

const LANGUAGES = [
  'plaintext','javascript','typescript','python','go','rust','ruby','java',
  'bash','sql','json','yaml','toml','html','css','markdown','dockerfile',
];

function homeView() {
  app.innerHTML = `
    <div class="container page">
      <h1 class="page-title">Share a note or file.</h1>
      <p class="page-sub">Paste text or upload a file — get a shareable link instantly.<br>Everything is stored in S3. Any replica, anywhere, can serve it.</p>

      ${storageWarning()}

      <div class="tabs" style="margin-bottom:28px">
        <button class="tab-btn active" id="tab-note" onclick="switchTab('note')">Note</button>
        <button class="tab-btn"        id="tab-file" onclick="switchTab('file')">File</button>
      </div>

      <div id="panel-note">${noteForm()}</div>
      <div id="panel-file" style="display:none">${fileForm()}</div>

      ${renderInfoBar()}
    </div>`;
}

function noteForm() {
  return `
    <div id="note-form">
      <div class="form-group">
        <label>Content</label>
        <textarea id="note-content" placeholder="Paste code, config, logs, anything…" spellcheck="false"></textarea>
      </div>
      <div class="form-group" style="max-width:220px">
        <label>Language</label>
        <select id="note-lang">
          ${LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
      </div>
      <button class="btn-primary" onclick="submitNote()">Share note →</button>
    </div>
    <div id="note-result" style="display:none"></div>`;
}

function fileForm() {
  return `
    <div id="file-form">
      <div class="dropzone" id="dropzone" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event)">
        <input type="file" id="file-input" onchange="onFileSelect(event)" />
        <div class="dropzone-icon">📎</div>
        <div class="dropzone-label">Drop a file here or <span>browse</span></div>
        <div class="dropzone-hint">Max 25 MB</div>
        <div class="dropzone-file" id="selected-file"></div>
      </div>
      <div class="spacer"></div>
      <button class="btn-primary" id="upload-btn" onclick="submitFile()" disabled>Upload →</button>
    </div>
    <div id="file-result" style="display:none"></div>`;
}

window.switchTab = function(tab) {
  $('tab-note').classList.toggle('active', tab === 'note');
  $('tab-file').classList.toggle('active', tab === 'file');
  $('panel-note').style.display = tab === 'note' ? '' : 'none';
  $('panel-file').style.display = tab === 'file' ? '' : 'none';
};

// ── Note submission ───────────────────────────────────────────────────────────

window.submitNote = async function() {
  const content  = $('note-content').value.trim();
  const language = $('note-lang').value;
  if (!content) { toast('Enter some content first'); return; }

  const btn = document.querySelector('#panel-note .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Sharing…';

  try {
    const { id } = await api('POST', '/api/notes', { content, language });
    const url = window.location.origin + `/note/${id}`;
    $('note-result').style.display = '';
    $('note-result').innerHTML = resultCard('Note shared!', url, id, 'note');
    $('note-form').style.display = 'none';
  } catch (e) {
    toast('Error: ' + e.message, 4000);
    btn.disabled = false;
    btn.textContent = 'Share note →';
  }
};

// ── File upload ───────────────────────────────────────────────────────────────

let selectedFile = null;

window.onDragOver = function(e) {
  e.preventDefault();
  $('dropzone').classList.add('drag-over');
};
window.onDragLeave = function() {
  $('dropzone').classList.remove('drag-over');
};
window.onDrop = function(e) {
  e.preventDefault();
  $('dropzone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setSelectedFile(file);
};
window.onFileSelect = function(e) {
  const file = e.target.files[0];
  if (file) setSelectedFile(file);
};

function setSelectedFile(file) {
  selectedFile = file;
  $('selected-file').textContent = `${file.name} · ${formatBytes(file.size)}`;
  $('upload-btn').disabled = false;
}

window.submitFile = async function() {
  if (!selectedFile) return;
  const btn = $('upload-btn');
  btn.disabled = true;
  btn.textContent = 'Uploading…';

  try {
    const fd = new FormData();
    fd.append('file', selectedFile);
    const { id, name, url: filePath } = await api('POST', '/api/files', fd);
    const url = window.location.origin + filePath;
    $('file-result').style.display = '';
    $('file-result').innerHTML = resultCard(`${name} uploaded`, url, `${id}/${encodeURIComponent(name)}`, 'file');
    $('file-form').style.display = 'none';
  } catch (e) {
    toast('Error: ' + e.message, 4000);
    btn.disabled = false;
    btn.textContent = 'Upload →';
  }
};

// ── Shared result card ────────────────────────────────────────────────────────

function resultCard(title, url, id, type) {
  return `<div class="result-card">
    <h3>✓ ${title}</h3>
    <div class="result-url">
      <span>${url}</span>
    </div>
    <div class="result-actions">
      <button class="btn-ghost" onclick="copyText('${url}')">Copy link</button>
      <a href="${url}" target="_blank"><button class="btn-ghost">Open →</button></a>
      <button class="btn-danger" onclick="deleteItem('${type}','${id}')">Delete</button>
    </div>
  </div>`;
}

window.deleteItem = async function(type, id) {
  if (!confirm('Delete this item?')) return;
  try {
    if (type === 'note') {
      await api('DELETE', `/api/notes/${id}`);
    } else {
      await api('DELETE', `/api/files/${id}`);
    }
    toast('Deleted');
    router();
  } catch (e) {
    toast('Error: ' + e.message, 4000);
  }
};

// ── Note view ─────────────────────────────────────────────────────────────────

async function noteView(id) {
  app.innerHTML = `<div class="container page"><p class="text-muted">Loading…</p></div>`;
  try {
    const note = await api('GET', `/api/notes/${id}`);
    const originLabel = note.origin?.location
      ? `${note.origin.cloud} · ${note.origin.location}`
      : 'local';

    app.innerHTML = `
      <div class="container page">
        <a class="back-link" href="/">← New stash</a>
        <div class="note-meta">
          <span class="meta-tag">${note.language || 'plaintext'}</span>
          <span class="meta-origin">Written from ${originLabel}</span>
          <span class="text-subtle">${formatDate(note.createdAt)}</span>
        </div>
        <pre class="note-content">${escapeHtml(note.content)}</pre>
        <div class="note-actions">
          <button class="btn-ghost" onclick="copyText(${JSON.stringify(note.content)})">Copy content</button>
          <button class="btn-ghost" onclick="copyText(window.location.href)">Copy link</button>
          <button class="btn-danger" onclick="deleteItem('note','${id}');history.pushState(null,'','/');router()">Delete</button>
        </div>
        ${renderInfoBar()}
      </div>`;
  } catch (e) {
    app.innerHTML = `<div class="container page">
      <a class="back-link" href="/">← Back</a>
      <p class="text-muted">${e.message === 'Note not found' ? 'This note does not exist or has been deleted.' : 'Failed to load note: ' + e.message}</p>
    </div>`;
  }
}

// ── File view ─────────────────────────────────────────────────────────────────

async function fileView(id, filename) {
  // The download endpoint streams directly — just redirect
  window.location.href = `/api/files/${id}/${filename}`;
}

// ── HTML escape ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Router ───────────────────────────────────────────────────────────────────

async function router() {
  const path = window.location.pathname;

  const noteMatch = path.match(/^\/note\/([a-zA-Z0-9_-]+)$/);
  if (noteMatch) return noteView(noteMatch[1]);

  const fileMatch = path.match(/^\/file\/([a-zA-Z0-9_-]+)\/(.+)$/);
  if (fileMatch) return fileView(fileMatch[1], fileMatch[2]);

  homeView();
}

window.addEventListener('popstate', router);

// Intercept same-origin link clicks for SPA navigation
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const url = new URL(a.href, location.origin);
  if (url.origin !== location.origin) return;
  if (a.target === '_blank') return;
  e.preventDefault();
  history.pushState(null, '', url.pathname);
  router();
});

// ── Boot ─────────────────────────────────────────────────────────────────────

(async () => {
  await loadInfo();
  router();
})();
