'use strict';

module.exports = function logger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    process.stdout.write(JSON.stringify({
      ts:     new Date().toISOString(),
      method: req.method,
      path:   req.path,
      status: res.statusCode,
      ms:     Date.now() - start,
    }) + '\n');
  });
  next();
};
