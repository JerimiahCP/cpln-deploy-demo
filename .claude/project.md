# Stash — Project Memory

> This file is the persistent context for Claude Code sessions on this project.
> **Keep it current.** When you make a meaningful change — new feature, architecture
> decision, config change, deployment — update the relevant section before the session ends.

---

## What this project is

**Stash** is a pastebin/file-sharing demo app built to showcase Control Plane's CI/CD and
cloud identity capabilities to engineering leaders and platform teams. It lets users share
notes (text/code) and upload files, backed by AWS S3.

The app itself is deliberately simple. The point is the platform story:
- One command deploys it globally
- No AWS credentials ever touch the code, image, or CI config
- Control Plane's workload identity injects temporary STS credentials at runtime
- Push to main → staging. Manual dispatch → production.

**Owner:** Jerimiah @ Control Plane (`jerimiah@controlplane.com`, GitHub: `JerimiahCP`)

---

## Repo

`https://github.com/JerimiahCP/cpln-deploy-demo`

---

## App architecture

**Stack:** Node.js 20 (main app), Go 1.22 (analyzer), Express, AWS SDK v3/v2

**Key files:**
```
app/
  server.js              — Express app entry point
  lib/
    config.js            — All env var reads and defaults (no docs, just mechanics)
    storage.js           — Picks backend: local (filesystem) or s3
    local.js             — Local filesystem storage backend
    s3.js                — AWS S3 storage backend
  routes/
    notes.js             — POST/GET/DELETE /api/notes
    files.js             — GET(list)/POST/GET/DELETE /api/files + GET insights sidecar
    info.js              — GET /api/info — runtime context
    health.js            — GET /health, /healthz
services/
  analyzer/
    main.go              — Go HTTP server: POST /analyze (reads S3, returns insights)
    go.mod               — Module: github.com/JerimiahCP/cpln-deploy-demo/services/analyzer
    Dockerfile           — Multi-stage: golang:1.22-alpine → alpine:3.19
cpln/
  gvc.yaml               — GVC template (locations set at provision time)
  identity.yaml          — stash-identity: AWS cloud account + S3 full access
  workload.yaml          — stash workload template
  analyzer-identity.yaml — analyzer-identity: AWS cloud account + S3 read-only access
  analyzer-workload.yaml — analyzer workload template (internal-only, no public inbound)
CONFIGURATION.md         — Single source of truth for what each env var means
.env.example             — Local dev template mirroring GitHub variables
```

**Storage abstraction:**
- `STORAGE_BACKEND=local` → writes to `DATA_DIR` on container filesystem
- `STORAGE_BACKEND=s3` → writes to S3; credentials injected by workload identity
- Both backends expose the same interface: `isConfigured`, `put`, `get`, `remove`, `list`
- S3 client uses `followRegionRedirects: true` (bucket is not in us-east-1)

**S3 key structure:** `<environment>/files/<id>/<filename>` and `<environment>/notes/<id>.json`

---

## Control Plane resources

| Resource | Name |
|---|---|
| Org | `cpln-customer-demos` |
| Production GVC | `stash-demo` |
| Staging GVC | `stash-staging` |
| Stash identity | `stash-identity` (per GVC) — S3 full access |
| Analyzer identity | `analyzer-identity` (per GVC) — S3 read-only |
| Stash image | `cpln-customer-demos.registry.cpln.io/stash` |
| Analyzer image | `cpln-customer-demos.registry.cpln.io/stash-analyzer` |
| AWS cloud account | `aws` |
| AWS IAM role | `arn:aws:iam::220461740468:role/cpln-cpln-customer-demos` |
| S3 bucket | `cpln-customer-demos` |

**Live endpoints:**
- Production: `https://stash-5b6z688ss8p3t.cpln.app`
- Staging: `https://stash-ez87tr1hxgrf6.cpln.app`

**GVC naming convention:** `stash-<environment>` — enforced by the provision workflow dropdown.

---

## GitHub Actions workflows

### `deploy.yml`
- **Push to `main`** → automatically deploys to `stash-staging`
- **Manual dispatch** → choose `staging` or `prod`
- Builds image tagged with git SHA, pushes to CPLN registry, renders YAML templates via `envsubst`, applies identity + workload only (never touches the GVC — locations are set at provision time)

### `provision-env.yml`
- **Manual dispatch only**
- Inputs: `environment` (dropdown: dev/staging/prod), `location_1` (dropdown), `location_2` (optional dropdown)
- Creates GVC + identity + workload for a new environment
- GVC name is always `stash-<environment>`
- Run once per environment; use deploy workflow for subsequent code changes

### `teardown-env.yml`
- **Manual dispatch** with confirmation guard

---

## GitHub configuration

**Secret (sensitive):**
- `CPLN_TOKEN` — Control Plane service account token

**Variables (non-sensitive):**
| Variable | Value |
|---|---|
| `CPLN_ORG` | `cpln-customer-demos` |
| `GVC_NAME` | `stash-demo` (production — used by legacy manual deploys) |
| `ENVIRONMENT` | `production` |
| `LOCATION_1` | `aws-us-east-1` |
| `STORAGE_BACKEND` | `s3` |
| `AWS_REGION` | `us-east-1` |
| `AWS_S3_BUCKET` | `cpln-customer-demos` |
| `AWS_CLOUD_ACCOUNT` | `aws` |
| `AWS_S3_POLICY` | `aws::AmazonS3FullAccess` |
| `ANALYZER_URL` | `http://analyzer` |

---

## Key architecture decisions

**No static AWS credentials — ever.**
The workload identity (`cpln/identity.yaml`) grants the workload permission to assume an
IAM role via Control Plane's cloud account. Control Plane injects temporary STS credentials
at runtime. The AWS SDK picks them up via the default credential chain. No
`AWS_ACCESS_KEY_ID` anywhere in the repo, image, or CI.

**CPLN registry, not Docker Hub.**
Images push to `cpln-customer-demos.registry.cpln.io`. Authenticated via `cpln image docker-login`
using the existing `CPLN_TOKEN`. No Docker Hub secrets needed.

**Deploy never touches the GVC.**
Locations are infrastructure — set once at provision time. The deploy workflow only renders
and applies `identity.yaml` and `workload.yaml`. Adding a second location to a GVC means
re-running Provision Environment.

**GitHub Actions variables are the single source of truth for config.**
`cpln/workload.yaml` uses `${VARIABLE}` placeholders. The deploy workflow injects values from
GitHub variables via `envsubst` before `cpln apply`. Developers read `CONFIGURATION.md` to
know what to set — they never edit YAML values directly.

**Push to main → staging only.**
Production requires a manual workflow dispatch. This was added after an accidental production
deploy of the Browse tab feature before it was validated in staging.

**`config.js` is mechanics only.**
All documentation for env vars lives in `CONFIGURATION.md`. `config.js` just reads env vars
and sets defaults — no inline docs.

---

## Current state (update this section each session)

**Last updated:** 2026-04-08

**What's deployed:**
- Production (`stash-demo`): Browse tab, no analyzer yet (analyzer added this session, not yet deployed to prod)
- Staging (`stash-staging`): Browse tab, no analyzer yet

**In progress / known issues:**
- `analyzer` service written but not yet deployed — needs a push to main or manual dispatch

**Recent changes:**
- Added `analyzer` Go microservice (`services/analyzer/`) — reads files from S3 using its own read-only identity, returns structured insights per file type (CSV, JSON, image, text, binary)
- Added `analyzer-identity` with `aws::AmazonS3ReadOnlyAccess` (separate from stash-identity which has FullAccess — demonstrates least-privilege)
- Added `analyzer-workload` — internal-only (no public inbound), accessible only from same-GVC workloads
- File view page now shows insights panel ("Analyzed by analyzer") before the download button
- Insights stored as sidecar `_insights.json` in S3 alongside each uploaded file
- Updated deploy, provision-env, and teardown-env workflows to handle both services
- Added `ANALYZER_URL` GitHub variable (set to `http://analyzer` for internal CPLN routing)
- Fixed teardown-env.yml: stash naming, vars.CPLN_ORG, environment dropdown
- Added Browse tab (file listing) to app and API
- Fixed deploy workflow: push to main now targets staging, not production
- Added LOCATION_2 support to provision-env workflow with dropdown inputs
- Enforced GVC naming convention (stash-<env>) via dropdown in provision workflow

---

## How to deploy manually

```bash
# Build and push image
docker buildx build --platform linux/amd64 \
  -t cpln-customer-demos.registry.cpln.io/stash:latest --push .

# Deploy (applies identity + workload to existing GVC)
cpln apply -f cpln/ --org cpln-customer-demos

# Provision a new environment (creates GVC + identity + workload)
# Use GitHub Actions → Provision Environment workflow
```

---

## Instructions for Claude

When starting a session on this project:
1. Read this file first to understand current state
2. Check `CONFIGURATION.md` for the full variable reference
3. Check `cpln/workload.yaml` and `cpln/identity.yaml` for current infrastructure config
4. If the user references something that might have changed, verify against actual files before assuming memory is current

When ending a session or after significant changes:
1. Update the **Current state** section with what was deployed and what changed
2. Add any new architecture decisions to the **Key architecture decisions** section
3. Update the **GitHub configuration** table if variables/secrets changed
4. Update **Live endpoints** if new environments were provisioned
5. Keep entries in **Recent changes** to the last 5-10 meaningful changes
