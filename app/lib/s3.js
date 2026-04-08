'use strict';

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const config = require('./config');

let _client = null;

function client() {
  if (!_client) {
    // Credentials come from the default chain: Control Plane injects
    // temporary STS credentials via the workload identity at runtime.
    // followRegionRedirects handles buckets whose region differs from the default.
    _client = new S3Client({ region: config.aws.region, followRegionRedirects: true });
  }
  return _client;
}

function isConfigured() {
  return Boolean(config.aws.bucket);
}

function requireBucket() {
  if (!config.aws.bucket) {
    const err = new Error('AWS_S3_BUCKET is not configured');
    err.status = 503;
    throw err;
  }
}

async function put(key, body, contentType, metadata = {}) {
  requireBucket();
  await client().send(new PutObjectCommand({
    Bucket:      config.aws.bucket,
    Key:         key,
    Body:        body,
    ContentType: contentType,
    Metadata:    metadata,
  }));
}

async function get(key) {
  requireBucket();
  const result = await client().send(new GetObjectCommand({
    Bucket: config.aws.bucket,
    Key:    key,
  }));
  const body = Buffer.from(await result.Body.transformToByteArray());
  return {
    body,
    contentType: result.ContentType || 'application/octet-stream',
    size:        result.ContentLength,
  };
}

async function remove(key) {
  requireBucket();
  await client().send(new DeleteObjectCommand({
    Bucket: config.aws.bucket,
    Key:    key,
  }));
}

async function list(prefix) {
  requireBucket();
  const res = await client().send(new ListObjectsV2Command({
    Bucket: config.aws.bucket,
    Prefix: prefix,
  }));
  return res.Contents || [];
}

module.exports = { isConfigured, put, get, remove, list };
