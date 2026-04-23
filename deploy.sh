#!/usr/bin/env bash
# deploy.sh — entry point for deploying the BDC Agent Coaching Dashboard to SPCS.
# Expires: 2026-05-23 (30 days from last review). Re-validate deps, costs, and
# Snowflake feature availability after this date before reusing in a demo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Locate deploy.env
if [[ -f "${SCRIPT_DIR}/deploy/deploy.env" ]]; then
    ENV_FILE="${SCRIPT_DIR}/deploy/deploy.env"
elif [[ -f "${SCRIPT_DIR}/deploy.env" ]]; then
    ENV_FILE="${SCRIPT_DIR}/deploy.env"
else
    echo "ERROR: deploy/deploy.env not found." >&2
    echo "Copy deploy/deploy.env.example to deploy/deploy.env and fill in values." >&2
    exit 1
fi

echo "Using config: ${ENV_FILE}"
# shellcheck source=/dev/null
source "${ENV_FILE}"

# Delegate to the SPCS deploy script
bash "${SCRIPT_DIR}/deploy/spcs/deploy-spcs.sh" "$@"

echo ""
echo "Deployment complete."
