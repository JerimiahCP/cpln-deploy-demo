'use strict';

// Picks the storage backend at startup based on STORAGE_BACKEND env var.
// Both backends expose the same interface:
//   isConfigured() → bool
//   put(key, body, contentType, metadata?) → Promise<void>
//   get(key) → Promise<{ body: Buffer, contentType: string, size: number }>
//   remove(key) → Promise<void>
//   list(prefix) → Promise<{ key: string }[]>

const config = require('./config');

module.exports = config.storageBackend === 's3'
  ? require('./s3')
  : require('./local');
