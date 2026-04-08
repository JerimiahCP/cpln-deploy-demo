'use strict';

const fs   = require('fs');
const path = require('path');

let _dataDir = null;

function dataDir() {
  if (!_dataDir) {
    // Lazy-require config to avoid circular deps at module load time
    _dataDir = require('./config').dataDir;
    fs.mkdirSync(_dataDir, { recursive: true });
  }
  return _dataDir;
}

function fullPath(key) {
  return path.join(dataDir(), key);
}

function noSuchKey() {
  const err = new Error('Not found');
  err.name = 'NoSuchKey';
  return err;
}

function isConfigured() {
  return true;
}

async function put(key, body, contentType, metadata = {}) {
  const filePath = fullPath(key);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath + '.meta.json',
    JSON.stringify({ contentType, metadata }), 'utf8');
  await fs.promises.writeFile(filePath, body);
}

async function get(key) {
  const filePath = fullPath(key);
  try {
    const body = await fs.promises.readFile(filePath);
    let contentType = 'application/octet-stream';
    try {
      const meta = JSON.parse(await fs.promises.readFile(filePath + '.meta.json', 'utf8'));
      contentType = meta.contentType || contentType;
    } catch { /* no metadata file — use default */ }
    return { body, contentType, size: body.length };
  } catch (err) {
    if (err.code === 'ENOENT') throw noSuchKey();
    throw err;
  }
}

async function remove(key) {
  const filePath = fullPath(key);
  try {
    await fs.promises.unlink(filePath);
    await fs.promises.unlink(filePath + '.meta.json').catch(() => {});
  } catch (err) {
    if (err.code === 'ENOENT') throw noSuchKey();
    throw err;
  }
}

async function list(prefix) {
  const results = [];

  async function walk(dir, keyPrefix) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      if (entry.name.endsWith('.meta.json')) continue;
      const entryPath = path.join(dir, entry.name);
      const entryKey  = keyPrefix + entry.name;
      if (entry.isDirectory()) {
        await walk(entryPath, entryKey + '/');
      } else {
        const stat = await fs.promises.stat(entryPath);
        results.push({ key: entryKey, size: stat.size, lastModified: stat.mtime.toISOString() });
      }
    }
  }

  await walk(fullPath(prefix), prefix);
  return results;
}

module.exports = { isConfigured, put, get, remove, list };
