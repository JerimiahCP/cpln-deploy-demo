# Stash — Control Plane Deploy Demo

A minimal pastebin/file-sharing app that demonstrates deploying to [Control Plane](https://controlplane.com) with a single command.

The app runs entirely self-contained with local volume storage by default. S3 is an optional upgrade for shared state and horizontal scaling.

---

## Deploy to Control Plane

### 1. Build and push your Docker image

```bash
docker build -t YOUR_DOCKER_HUB_USERNAME/stash:latest .
docker push YOUR_DOCKER_HUB_USERNAME/stash:latest
```

### 2. Set your image in the workload

Edit `cpln/workload.yaml` and replace `YOUR_DOCKER_HUB_USERNAME/stash:latest` with your image reference.

### 3. Deploy

```bash
cpln apply -f cpln/ --org YOUR_ORG
```

That's it. Control Plane creates the GVC, identity, volume, and workload. Once ready, get the endpoint:

```bash
cpln workload get stash --gvc stash --org YOUR_ORG -o json \
  | jq -r '.status.endpoint'
```

---

## Switching to S3 storage

Since you've preconfigured the S3 bucket and credentials in Control Plane, switching from local volume storage to S3 requires three edits to `cpln/workload.yaml` and one to `cpln/identity.yaml`.

### 1. Update `cpln/identity.yaml` — add AWS cloud account access

```yaml
kind: identity
name: stash-identity
gvc: stash
spec:
  aws:
    cloudAccountLink: /org/YOUR_ORG/cloudaccount/YOUR_CLOUD_ACCOUNT
    policyRefs:
      - "arn:aws:iam::YOUR_ACCOUNT_ID:policy/YOUR_S3_POLICY"
```

### 2. Update `cpln/workload.yaml` — switch backend and add bucket config

In the `env` section, change `STORAGE_BACKEND` to `s3` and add your bucket details. Since you've preconfigured these in Control Plane as secrets, reference them with `cpln://` URIs:

```yaml
      env:
        - name: PORT
          value: "8080"
        - name: ENVIRONMENT
          value: "production"
        - name: STORAGE_BACKEND
          value: "s3"
        - name: AWS_REGION
          value: "us-east-1"
        - name: AWS_S3_BUCKET
          value: cpln://secret/stash-config.bucket   # or a plain string if not a secret
```

Remove the `volumes` block from the container and the `volumeset.yaml` from the apply (or just leave both — the volume will be unused):

```yaml
      # remove or comment out:
      # volumes:
      #   - path: /data
      #     uri: cpln://volumeset/stash-data
      #     recoveryPolicy: retain
```

Also raise `maxScale` now that storage is shared:

```yaml
  defaultOptions:
    autoscaling:
      metric: rps
      minScale: 1
      maxScale: 10
```

### 3. Apply

```bash
cpln apply -f cpln/ --org YOUR_ORG
```

Control Plane will update the identity with AWS federation, inject temporary STS credentials into the workload automatically, and route traffic once the new replica passes health checks.

---

## Control Plane resources

```
org: YOUR_ORG
└── gvc: stash
    ├── identity: stash-identity
    ├── volumeset: stash-data       (local storage mode only)
    └── workload: stash
        ├── image: YOUR_IMAGE
        ├── env: STORAGE_BACKEND=local|s3
        ├── volume: /data → stash-data  (local mode)
        ├── autoscaling: 1 replica (local) / 1–10 (S3)
        └── firewall: public HTTPS
```

---

## Local development

```bash
cd app
npm install
node server.js
# open http://localhost:8080
# data is written to ./data/ (gitignored)
```

Build and run the Docker image locally:

```bash
docker build -t stash:local .
docker run -p 8080:8080 -v $(pwd)/data:/data stash:local
```

---

## Storage backends

| | Local volume | S3 |
|---|---|---|
| Setup required | None | AWS bucket + Control Plane cloud account |
| Data shared across replicas | No | Yes |
| Max replicas | 1 | 10 |
| Credentials | None | Injected by Control Plane identity (no static keys) |
| Switch | `STORAGE_BACKEND=local` | `STORAGE_BACKEND=s3` |
