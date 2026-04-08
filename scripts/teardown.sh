#!/usr/bin/env bash
# teardown.sh — delete a ShipFast environment from Control Plane
#
# Usage:
#   ENVIRONMENT=dev ./scripts/teardown.sh
#   ENVIRONMENT=feature-auth CPLN_ORG=my-org ./scripts/teardown.sh

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-dev}"
GVC_NAME="shipfast-${ENVIRONMENT}"
CPLN_ORG="${CPLN_ORG:-$(cpln org get -o json | jq -r '.[0].name' 2>/dev/null || echo '')}"

if [ -z "$CPLN_ORG" ]; then
  echo "Error: CPLN_ORG not set and could not be inferred from cpln profile."
  exit 1
fi

echo "Tearing down environment: ${ENVIRONMENT} (org: ${CPLN_ORG})"
read -rp "Are you sure? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

cpln workload delete shipfast  --gvc "${GVC_NAME}" --org "${CPLN_ORG}" || true
cpln identity delete shipfast-identity --gvc "${GVC_NAME}" --org "${CPLN_ORG}" || true
cpln gvc delete "${GVC_NAME}" --org "${CPLN_ORG}" || true

echo "Done. Environment '${ENVIRONMENT}' removed."
