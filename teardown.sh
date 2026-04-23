#!/usr/bin/env bash
# teardown.sh — remove Snowflake resources created for the BDC demo.
# Reads all object names from deploy.env (fully parameterized).
#
# Expires: 2026-05-23 (30 days from last review). Re-validate before reuse.
#
# Iceberg-era: Snowflake-managed Iceberg tables (CATALOG='SNOWFLAKE') live in
# the RAW schema. No external volumes, no pg_lake, no S3 to clean up.
#
# Usage:
#   bash teardown.sh                   # interactive teardown (schemas + SPCS objects)
#   bash teardown.sh --nuclear         # also drop entire database CASCADE
#   bash teardown.sh --yes             # skip confirmation prompt
#   bash teardown.sh --env path.env    # use alternate env file (e.g. for legacy cleanup)
#   bash teardown.sh --nuclear --yes   # scripted full teardown
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
NUCLEAR=false
AUTO_YES=false
CUSTOM_ENV=""
for arg in "$@"; do
    case "${arg}" in
        --nuclear)  NUCLEAR=true ;;
        --yes)      AUTO_YES=true ;;
        --env)      shift; CUSTOM_ENV="$1" ;; # handled below
        --env=*)    CUSTOM_ENV="${arg#--env=}" ;;
    esac
    shift 2>/dev/null || true
done

# ---------------------------------------------------------------------------
# Load config
# ---------------------------------------------------------------------------
if [[ -n "${CUSTOM_ENV}" ]]; then
    ENV_FILE="${CUSTOM_ENV}"
elif [[ -f "${SCRIPT_DIR}/deploy/deploy.env" ]]; then
    ENV_FILE="${SCRIPT_DIR}/deploy/deploy.env"
elif [[ -f "${SCRIPT_DIR}/deploy.env" ]]; then
    ENV_FILE="${SCRIPT_DIR}/deploy.env"
else
    echo "ERROR: deploy/deploy.env not found. Specify --env <path> or create deploy.env." >&2
    exit 1
fi

# shellcheck source=/dev/null
source "${ENV_FILE}"

: "${SNOWFLAKE_CONNECTION:?env must set SNOWFLAKE_CONNECTION}"
: "${SPCS_DATABASE:?env must set SPCS_DATABASE}"
: "${SPCS_SCHEMA:?env must set SPCS_SCHEMA}"
: "${SPCS_COMPUTE_POOL:?env must set SPCS_COMPUTE_POOL}"
: "${SPCS_SERVICE_NAME:?env must set SPCS_SERVICE_NAME}"
: "${SPCS_IMAGE_REPO:?env must set SPCS_IMAGE_REPO}"
: "${SPCS_STD_WAREHOUSE:?env must set SPCS_STD_WAREHOUSE}"
: "${SPCS_INTERACTIVE_WAREHOUSE:?env must set SPCS_INTERACTIVE_WAREHOUSE}"
: "${SPCS_EAI:?env must set SPCS_EAI}"
: "${SPCS_EGRESS_RULE:?env must set SPCS_EGRESS_RULE}"

SF="snow sql -c ${SNOWFLAKE_CONNECTION} -q"

# ---------------------------------------------------------------------------
# Confirmation prompt
# ---------------------------------------------------------------------------
echo ""
echo "======================================================"
echo "  BDC DEMO TEARDOWN"
echo "  Config: ${ENV_FILE}"
echo "  This will remove:"
echo "    - Task:                DAILY_CALL_GENERATOR"
echo "    - Service:             ${SPCS_DATABASE}.${SPCS_SCHEMA}.${SPCS_SERVICE_NAME}"
echo "    - Compute pool:        ${SPCS_COMPUTE_POOL}"
echo "    - Image repository:    ${SPCS_DATABASE}.${SPCS_SCHEMA}.${SPCS_IMAGE_REPO}"
echo "    - Std warehouse:       ${SPCS_STD_WAREHOUSE}"
echo "    - Interactive WH:      ${SPCS_INTERACTIVE_WAREHOUSE}"
echo "    - EAI + network rule:  ${SPCS_EAI}, ${SPCS_EGRESS_RULE}"
echo "    - Cortex objects:      COACHING_AGENT, CALL_TRANSCRIPT_SEARCH"
echo "    - Iceberg tables:      6 Snowflake-managed Iceberg tables in RAW"
echo "    - DCM project:         BDC_DCM_PROJECT"
echo "    - Schemas:             RAW, ANALYTICS, COACHING, ${SPCS_SCHEMA}"
if [[ "${NUCLEAR}" == "true" ]]; then
    echo "    - DATABASE (CASCADE):  ${SPCS_DATABASE}  *** NUCLEAR ***"
fi
echo "======================================================"
echo ""

if [[ "${AUTO_YES}" != "true" ]]; then
    read -r -p "Type 'yes' to confirm teardown: " CONFIRM
    if [[ "${CONFIRM}" != "yes" ]]; then
        echo "Aborted."
        exit 0
    fi
fi

run_sql() {
    local label="$1"
    local query="$2"
    echo "==> ${label}"
    ${SF} "${query}" 2>&1 || echo "    (skipped or already removed)"
}

echo ""

# ---- 1. Suspend and drop scheduled tasks ----
run_sql "Suspending daily call generator task" \
    "ALTER TASK IF EXISTS ${SPCS_DATABASE}.RAW.DAILY_CALL_GENERATOR SUSPEND"

run_sql "Dropping daily call generator task" \
    "DROP TASK IF EXISTS ${SPCS_DATABASE}.RAW.DAILY_CALL_GENERATOR"

# ---- 2. Drop SPCS service ----
run_sql "Dropping service" \
    "DROP SERVICE IF EXISTS ${SPCS_DATABASE}.${SPCS_SCHEMA}.${SPCS_SERVICE_NAME}"

# ---- 3. Stop and drop compute pool ----
run_sql "Stopping compute pool" \
    "ALTER COMPUTE POOL IF EXISTS ${SPCS_COMPUTE_POOL} STOP ALL"

echo "    Waiting for pool to drain..."
sleep 5

run_sql "Dropping compute pool" \
    "DROP COMPUTE POOL IF EXISTS ${SPCS_COMPUTE_POOL}"

# ---- 4. Drop image repository ----
run_sql "Dropping image repository" \
    "DROP IMAGE REPOSITORY IF EXISTS ${SPCS_DATABASE}.${SPCS_SCHEMA}.${SPCS_IMAGE_REPO}"

# ---- 5. Drop warehouses ----
run_sql "Dropping interactive warehouse" \
    "DROP WAREHOUSE IF EXISTS ${SPCS_INTERACTIVE_WAREHOUSE}"

run_sql "Dropping standard warehouse" \
    "DROP WAREHOUSE IF EXISTS ${SPCS_STD_WAREHOUSE}"

# ---- 6. Drop external access integration + network rule ----
run_sql "Dropping external access integration" \
    "DROP EXTERNAL ACCESS INTEGRATION IF EXISTS ${SPCS_EAI}"

run_sql "Dropping network rule" \
    "DROP NETWORK RULE IF EXISTS ${SPCS_DATABASE}.${SPCS_SCHEMA}.${SPCS_EGRESS_RULE}"

# ---- 7. Drop Cortex objects (before schema CASCADE, for explicit cleanup) ----
run_sql "Dropping Cortex Agent" \
    "DROP AGENT IF EXISTS ${SPCS_DATABASE}.COACHING.COACHING_AGENT"

run_sql "Dropping Cortex Search Service" \
    "DROP CORTEX SEARCH SERVICE IF EXISTS ${SPCS_DATABASE}.COACHING.CALL_TRANSCRIPT_SEARCH"

# ---- 8. Drop Snowflake-managed Iceberg tables ----
run_sql "Dropping CALLS_ICEBERG" \
    "DROP ICEBERG TABLE IF EXISTS ${SPCS_DATABASE}.RAW.CALLS_ICEBERG"

run_sql "Dropping CALL_TRANSCRIPTS_ICEBERG" \
    "DROP ICEBERG TABLE IF EXISTS ${SPCS_DATABASE}.RAW.CALL_TRANSCRIPTS_ICEBERG"

run_sql "Dropping CALL_SCORES_ICEBERG" \
    "DROP ICEBERG TABLE IF EXISTS ${SPCS_DATABASE}.RAW.CALL_SCORES_ICEBERG"

run_sql "Dropping CALL_AI_ENRICHMENTS_ICEBERG" \
    "DROP ICEBERG TABLE IF EXISTS ${SPCS_DATABASE}.RAW.CALL_AI_ENRICHMENTS_ICEBERG"

run_sql "Dropping APPOINTMENTS_ICEBERG" \
    "DROP ICEBERG TABLE IF EXISTS ${SPCS_DATABASE}.RAW.APPOINTMENTS_ICEBERG"

run_sql "Dropping AGENT_DAILY_METRICS_ICEBERG" \
    "DROP ICEBERG TABLE IF EXISTS ${SPCS_DATABASE}.RAW.AGENT_DAILY_METRICS_ICEBERG"

# ---- 9. Drop DCM project ----
run_sql "Dropping DCM project" \
    "DROP DCM PROJECT IF EXISTS ${SPCS_DATABASE}.PUBLIC.BDC_DCM_PROJECT"

# ---- 10. Drop schemas ----
run_sql "Dropping COACHING schema (CASCADE)" \
    "DROP SCHEMA IF EXISTS ${SPCS_DATABASE}.COACHING CASCADE"

run_sql "Dropping ANALYTICS schema (CASCADE)" \
    "DROP SCHEMA IF EXISTS ${SPCS_DATABASE}.ANALYTICS CASCADE"

run_sql "Dropping RAW schema (CASCADE)" \
    "DROP SCHEMA IF EXISTS ${SPCS_DATABASE}.RAW CASCADE"

run_sql "Dropping SPCS schema (CASCADE)" \
    "DROP SCHEMA IF EXISTS ${SPCS_DATABASE}.${SPCS_SCHEMA} CASCADE"

# ---- 11. Nuclear option — drop entire database ----
if [[ "${NUCLEAR}" == "true" ]]; then
    run_sql "Dropping database ${SPCS_DATABASE} (CASCADE)" \
        "DROP DATABASE IF EXISTS ${SPCS_DATABASE} CASCADE"
fi

echo ""
echo "Teardown complete."
