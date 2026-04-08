'use strict';

const express = require('express');
const path    = require('path');
const config  = require('./lib/config');
const logger  = require('./middleware/logger');
const errors  = require('./middleware/errors');

const app = express();

app.use(logger);
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/',           require('./routes/health'));
app.use('/api/info',   require('./routes/info'));
app.use('/api/notes',  require('./routes/notes'));
app.use('/api/files',  require('./routes/files'));

// SPA fallback — serve index.html for client-side routes
app.get(['/note/:id', '/file/:id/:filename', '/'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errors);

app.listen(config.port, () => {
  console.log(JSON.stringify({
    ts:          new Date().toISOString(),
    event:       'startup',
    version:     config.buildVersion,
    environment: config.environment,
    port:        config.port,
    s3Bucket:    config.aws.bucket || '(not configured)',
  }));
});
