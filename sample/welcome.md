# Welcome to Stash

Stash is a lightweight note and file sharing app running on [Control Plane](https://controlplane.com).

## What it does

- **Notes** — paste text or code and get a shareable link instantly
- **Files** — upload any file (up to 25 MB) and share the download link
- **Multi-region** — Control Plane routes requests to the nearest healthy replica automatically

## How this is deployed

```
org: cpln-customer-demos
└── gvc: stash-demo (aws-us-east-1)
    ├── identity: stash-identity
    │   └── aws: role/cpln-cpln-customer-demos → S3 access
    └── workload: stash
        ├── image: cpln-customer-demos.registry.cpln.io/stash:latest
        ├── storage: S3 bucket cpln-customer-demos
        └── autoscaling: 1–5 replicas (RPS-based)
```

## No secrets in code

AWS credentials are never stored in the image or config files.
Control Plane's workload identity assumes an IAM role and injects
temporary STS credentials at runtime automatically.

## Try it

```bash
# Post a note
curl -X POST https://<endpoint>/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"content": "hello from Stash", "language": "plaintext"}'

# Upload a file
curl -X POST https://<endpoint>/api/files \
  -F file=@welcome.md

# Check deployment info
curl https://<endpoint>/api/info
```
