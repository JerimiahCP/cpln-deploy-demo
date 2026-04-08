# Configuration

All configuration is managed in one place: **GitHub Actions variables and secrets**.

The deploy workflow reads these values, injects them into the Control Plane YAML templates,
and applies everything in a single run. To change any config, update the GitHub variable
and re-run the workflow — no YAML editing required.

For local development, copy `.env.example` to `.env` and fill in the values.

---

## GitHub Setup

Go to your repo → **Settings → Secrets and variables → Actions**

### Secrets (sensitive — values are hidden in logs)

| Secret | Description | How to get it |
|---|---|---|
| `CPLN_TOKEN` | Control Plane service account token | Console → Org → Service Accounts → create one, generate a key |

### Variables (non-sensitive — values are visible in logs)

| Variable | Description | Example |
|---|---|---|
| `CPLN_ORG` | Your Control Plane org name | `cpln-customer-demos` |
| `GVC_NAME` | The Global Virtual Cloud to deploy into | `stash-demo` |
| `ENVIRONMENT` | Label for this deployment — used as the S3 path prefix | `production` |
| `LOCATION_1` | Control Plane location to run in | `aws-us-east-1` |
| `STORAGE_BACKEND` | Storage driver: `local` or `s3` | `s3` |
| `AWS_REGION` | AWS region your S3 bucket is in | `us-east-1` |
| `AWS_S3_BUCKET` | S3 bucket name — ask your platform team | `cpln-customer-demos` |
| `AWS_CLOUD_ACCOUNT` | Control Plane cloud account resource name | `aws` |
| `AWS_S3_POLICY` | AWS managed policy granting S3 access | `aws::AmazonS3FullAccess` |

---

## How it flows

```
GitHub Variables/Secrets
        ↓
  deploy.yml (envsubst)
        ↓
  cpln/ YAML templates → cpln-rendered/ → cpln apply
        ↓
  Control Plane workload running with your config
```

The `cpln/` YAML files contain `${VARIABLE}` placeholders — they have no hardcoded values.
The workflow substitutes every placeholder from GitHub variables before applying.

---

## Local development

Copy `.env.example` to `.env` — it mirrors the GitHub variables above.

```bash
cp .env.example .env
# fill in your values, then:
cd app && npm install && node server.js
```

AWS credentials for local S3 access go in `.env` as `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY`. These are gitignored and only ever used on your machine.
In deployed environments credentials are injected automatically by the workload
identity — you never configure them.
