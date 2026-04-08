'use strict';

const router  = require('express').Router();
const config  = require('../lib/config');
const storage = require('../lib/storage');

router.get('/', (_req, res) => {
  res.json({
    app:         'stash',
    version:     config.buildVersion,
    buildTime:   config.buildTime,
    environment: config.environment,
    location:    config.cpln.location,
    cloud:       config.cpln.cloud,
    gvc:         config.cpln.gvc,
    org:         config.cpln.org,
    workload:    config.cpln.workload,
    uptime:      Math.floor(process.uptime()),
    storage: {
      backend:    config.storageBackend,
      configured: storage.isConfigured(),
      bucket:     config.aws.bucket || null,
      region:     config.aws.region,
    },
  });
});

module.exports = router;
