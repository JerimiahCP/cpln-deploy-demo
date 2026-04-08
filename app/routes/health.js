'use strict';

const router = require('express').Router();

router.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
router.get('/health',  (_req, res) => res.json({ status: 'ok' }));

module.exports = router;
