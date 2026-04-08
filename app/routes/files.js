'use strict';

const router  = require('express').Router();
const busboy  = require('busboy');
const storage = require('../lib/storage');
const { generate } = require('../lib/id');
const config  = require('../lib/config');

function fileKey(id, filename) {
  return `${config.environment}/files/${id}/${filename}`;
}

function insightsKey(id) {
  return `${config.environment}/files/${id}/_insights.json`;
}

// GET /api/files — list all files for this environment
router.get('/', async (req, res, next) => {
  try {
    const prefix = `${config.environment}/files/`;
    const items  = await storage.list(prefix);
    const files  = items
      .map(item => {
        // key format: <environment>/files/<id>/<filename>
        // skip sidecar files (_insights.json)
        const rest  = item.key.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash === -1) return null;
        const id   = rest.slice(0, slash);
        const name = rest.slice(slash + 1);
        if (!id || !name || name.startsWith('_')) return null;
        return { id, name, size: item.size, lastModified: item.lastModified,
                 url: `/file/${id}/${encodeURIComponent(name)}` };
      })
      .filter(Boolean);
    res.json(files);
  } catch (err) {
    next(err);
  }
});

// POST /api/files — upload file, then call analyzer for insights
router.post('/', (req, res, next) => {
  const bb = busboy({ headers: req.headers, limits: { fileSize: config.upload.maxBytes } });
  let settled = false;

  bb.on('file', (field, stream, info) => {
    const { filename, mimeType } = info;
    if (!filename) {
      stream.resume();
      return;
    }

    const id     = generate();
    const key    = fileKey(id, filename);
    const chunks = [];

    stream.on('data',  chunk => chunks.push(chunk));

    stream.on('limit', () => {
      if (settled) return;
      settled = true;
      res.status(413).json({ error: `File exceeds ${config.upload.maxBytes / 1024 / 1024} MB limit` });
    });

    stream.on('end', async () => {
      if (settled) return;
      try {
        const buffer = Buffer.concat(chunks);
        await storage.put(key, buffer, mimeType || 'application/octet-stream', {
          'original-name': filename,
        });

        // Call the analyzer service and persist insights as a sidecar.
        // Non-blocking: a failure here does not affect the upload response.
        callAnalyzer(id, key).catch(e => console.warn('analyzer:', e.message));

        settled = true;
        res.status(201).json({
          id,
          name: filename,
          size: buffer.length,
          url:  `/file/${id}/${encodeURIComponent(filename)}`,
        });
      } catch (err) {
        settled = true;
        next(err);
      }
    });
  });

  bb.on('error', next);
  req.pipe(bb);
});

async function callAnalyzer(id, key) {
  if (!config.analyzerUrl || !config.aws.bucket) return;

  const res = await fetch(`${config.analyzerUrl}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: config.aws.bucket, key }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`analyzer returned ${res.status}`);
  }

  const insights = await res.json();
  await storage.put(
    insightsKey(id),
    JSON.stringify(insights),
    'application/json',
  );
}

// GET /api/files/:id/:filename/insights — fetch analyzer results for a file
router.get('/:id/:filename/insights', async (req, res, next) => {
  try {
    const result = await storage.get(insightsKey(req.params.id));
    res.json(JSON.parse(result.body.toString()));
  } catch (err) {
    if (err.name === 'NoSuchKey') return res.json(null);
    next(err);
  }
});

// GET /api/files/:id/:filename — retrieve file from storage backend
router.get('/:id/:filename', async (req, res, next) => {
  try {
    const key    = fileKey(req.params.id, req.params.filename);
    const result = await storage.get(key);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    if (result.size) res.setHeader('Content-Length', result.size);
    res.send(result.body);
  } catch (err) {
    if (err.name === 'NoSuchKey') return res.status(404).json({ error: 'File not found' });
    next(err);
  }
});

// DELETE /api/files/:id/:filename
router.delete('/:id/:filename', async (req, res, next) => {
  try {
    await storage.remove(fileKey(req.params.id, req.params.filename));
    // Best-effort cleanup of sidecar; ignore if absent
    storage.remove(insightsKey(req.params.id)).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    if (err.name === 'NoSuchKey') return res.status(404).json({ error: 'File not found' });
    next(err);
  }
});

module.exports = router;
