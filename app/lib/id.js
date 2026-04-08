'use strict';

// nanoid v3 (CommonJS) — short, URL-safe IDs
const { nanoid } = require('nanoid');

module.exports = { generate: () => nanoid(8) };
