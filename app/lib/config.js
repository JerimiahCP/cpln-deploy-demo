'use strict';

const path = require('path');

function parseLocation(raw) {
  if (!raw) return null;
  return raw.split('/').filter(Boolean).pop();
}

function cloudFromLocation(loc) {
  if (!loc)                    return 'local';
  if (loc.startsWith('aws'))   return 'AWS';
  if (loc.startsWith('gcp'))   return 'GCP';
  if (loc.startsWith('azure')) return 'Azure';
  return 'Unknown';
}

const location = parseLocation(process.env.CPLN_LOCATION);

module.exports = {
  port:           parseInt(process.env.PORT || '8080', 10),
  environment:    process.env.ENVIRONMENT    || 'local',
  buildVersion:   process.env.BUILD_VERSION  || 'local',
  buildTime:      process.env.BUILD_TIME     || new Date().toISOString(),
  storageBackend: process.env.STORAGE_BACKEND || 'local',
  dataDir:        process.env.DATA_DIR || path.join(__dirname, '../../data'),
  aws: {
    region: process.env.AWS_REGION    || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET || null,
  },
  cpln: {
    org:      process.env.CPLN_ORG           || 'local',
    gvc:      process.env.CPLN_GVC           || 'local',
    workload: process.env.CPLN_WORKLOAD_NAME || 'stash',
    location,
    cloud: cloudFromLocation(location),
  },
  upload: {
    maxBytes: parseInt(process.env.MAX_UPLOAD_MB || '25', 10) * 1024 * 1024,
  },
};
