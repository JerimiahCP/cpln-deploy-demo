'use strict';

const router  = require('express').Router();
const storage = require('../lib/storage');
const { generate } = require('../lib/id');
const config  = require('../lib/config');

function noteKey(id) {
  return `${config.environment}/notes/${id}.json`;
}

// POST /api/notes — create a note
router.post('/', async (req, res, next) => {
  try {
    const { content, language = 'plaintext' } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }
    if (content.length > 500_000) {
      return res.status(400).json({ error: 'content too large (max 500 KB)' });
    }

    const id   = generate();
    const note = {
      id,
      content,
      language,
      createdAt: new Date().toISOString(),
      origin: {
        location: config.cpln.location,
        cloud:    config.cpln.cloud,
        env:      config.environment,
      },
    };

    await storage.put(noteKey(id), JSON.stringify(note), 'application/json');
    res.status(201).json({ id, url: `/note/${id}` });
  } catch (err) {
    next(err);
  }
});

// GET /api/notes/:id — retrieve a note
router.get('/:id', async (req, res, next) => {
  try {
    const result = await storage.get(noteKey(req.params.id));
    res.json(JSON.parse(result.body.toString()));
  } catch (err) {
    if (err.name === 'NoSuchKey') return res.status(404).json({ error: 'Note not found' });
    next(err);
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await storage.remove(noteKey(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    if (err.name === 'NoSuchKey') return res.status(404).json({ error: 'Note not found' });
    next(err);
  }
});

module.exports = router;
