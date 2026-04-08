#!/usr/bin/env bash
# provision.sh — create a new ShipFast environment on Control Plane
#
# Usage:
#   ./scripts/provision.sh                         # env=dev, org from cpln profile
#   ENVIRONMENT=staging ./scripts/provision.sh
#   ENVIRONMENT=prod CPLN_ORG=my-org LOCATIONS="aws-us-east-1 gcp-us-east1" ./scripts/provision.sh

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-dev}"
GVC_NAME="shipfast-${ENVIRONMENT}"
CPLN_ORG="${CPLN_ORG:-$(cpln org get -o json | jq -r '.[0].name' 2>/dev/null || echo '')}"
DOCKER_IMAGE="${DOCKER_IMAGE:-docker.io/YOUR_DOCKERHUB_USERNAME/shipfast:latest}"

# Default locations (space-separated)
read -ra LOCATION_ARRAY <<< "${LOCATIONS:-aws-us-east-1 gcp-us-east1}"
LOCATION_1="${LOCATION_ARRAY[0]}"
LOCATION_2="${LOCATION_ARRAY[1]:-}"

if [ -z "$CPLN_ORG" ]; then
  echo "Error: CPLN_ORG not set and could not be inferred from cpln profile."
  exit 1
fi

echo "Provisioning environment: ${ENVIRONMENT}"
echo "  Org:       ${CPLN_ORG}"
echo "  GVC:       ${GVC_NAME}"
echo "  Locations: ${LOCATION_1} ${LOCATION_2}"
echo ""

# ── Render templates ──────────────────────────────────────────────────────────
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

export GVC_NAME ENVIRONMENT LOCATION_1 LOCATION_2
export IMAGE_TAG="${DOCKER_IMAGE}"
export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

envsubst < "$(dirname "$0")/../cpln/gvc.yaml"      > "${TMPDIR}/gvc.yaml"
envsubst < "$(dirname "$0")/../cpln/identity.yaml" > "${TMPDIR}/identity.yaml"
envsubst < "$(dirname "$0")/../cpln/workload.yaml" > "${TMPDIR}/workload.yaml"

# Remove second location line if not set
if [ -z "$LOCATION_2" ]; then
  grep -v 'LOCATION_2' "${TMPDIR}/gvc.yaml" > "${TMPDIR}/gvc.yaml.tmp" && mv "${TMPDIR}/gvc.yaml.tmp" "${TMPDIR}/gvc.yaml"
fi

# ── Apply ─────────────────────────────────────────────────────────────────────
echo "Applying resources..."
cpln apply -f "${TMPDIR}/" --org "${CPLN_ORG}"

echo ""
echo "Done! Environment '${ENVIRONMENT}' is provisioned."
echo "Run the Deploy workflow (or build+push manually) to ship code to it."
