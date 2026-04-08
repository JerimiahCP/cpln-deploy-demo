'use strict';

const router  = require('express').Router();
const busboy  = require('busboy');
const storage = require('../lib/storage');
const { generate } = require('../lib/id');
const config  = require('../lib/config');

function fileKey(id, filename) {
  return `${config.environment}/files/${id}/${filename}`;
}

// GET /api/files — list all files for this environment
router.get('/', async (req, res, next) => {
  try {
    const prefix = `${config.environment}/files/`;
    const items  = await storage.list(prefix);
    const files  = items
      .map(item => {
        // key format: <environment>/files/<id>/<filename>
        const rest  = item.key.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash === -1) return null;
        const id   = rest.slice(0, slash);
        const name = rest.slice(slash + 1);
        if (!id || !name) return null;
        return { id, name, size: item.size, lastModified: item.lastModified,
                 url: `/file/${id}/${encodeURIComponent(name)}` };
      })
      .filter(Boolean);
    res.json(files);
  } catch (err) {
    next(err);
  }
});

// POST /api/files — buffer upload, store via storage backend
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
    res.json({ ok: true });
  } catch (err) {
    if (err.name === 'NoSuchKey') return res.status(404).json({ error: 'File not found' });
    next(err);
  }
});

module.exports = router;
