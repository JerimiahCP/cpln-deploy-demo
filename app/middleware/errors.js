'use strict';

// Central error handler — must have 4 params for Express to treat it as error middleware
// eslint-disable-next-line no-unused-vars
module.exports = function errors(err, req, res, next) {
  console.error(JSON.stringify({
    ts:     new Date().toISOString(),
    error:  err.message,
    status: err.status || 500,
  }));
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
};
