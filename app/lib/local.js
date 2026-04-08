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
  const dir = fullPath(prefix);
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && !e.name.endsWith('.meta.json'))
      .map(e => ({ key: path.join(prefix, e.name) }));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

module.exports = { isConfigured, put, get, remove, list };
