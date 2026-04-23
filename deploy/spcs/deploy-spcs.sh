#!/usr/bin/env bash
# deploy-spcs.sh — Build, push, and deploy the BDC coaching service to SPCS.
# Uses unique image tags (SPCS caches :latest) and ALTER SERVICE to preserve
# the endpoint URL across deploys.
#
# Prerequisites:
#   - snow CLI installed and connection configured
#   - Docker Desktop running
#   - deploy/deploy.env populated
#
# Usage:
#   bash deploy/spcs/deploy-spcs.sh              # full deploy (DCM + images + service)
#   bash deploy/spcs/deploy-spcs.sh --images     # images + service only (skip DCM)
#   bash deploy/spcs/deploy-spcs.sh --dcm        # DCM only (skip images + service)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
SKIP_DCM=false
SKIP_IMAGES=false
for arg in "$@"; do
    case "${arg}" in
        --images) SKIP_DCM=true ;;
        --dcm)    SKIP_IMAGES=true ;;
    esac
done

# ---------------------------------------------------------------------------
# Load configuration
# ---------------------------------------------------------------------------
ENV_FILE="${REPO_ROOT}/deploy/deploy.env"
if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ERROR: ${ENV_FILE} not found. Copy deploy/deploy.env.example and fill in values." >&2
    exit 1
fi
# shellcheck source=/dev/null
source "${ENV_FILE}"

: "${SNOWFLAKE_CONNECTION:?deploy.env must set SNOWFLAKE_CONNECTION}"
: "${SPCS_DATABASE:?deploy.env must set SPCS_DATABASE}"
: "${SPCS_SCHEMA:?deploy.env must set SPCS_SCHEMA}"
: "${SPCS_COMPUTE_POOL:?deploy.env must set SPCS_COMPUTE_POOL}"
: "${SPCS_SERVICE_NAME:?deploy.env must set SPCS_SERVICE_NAME}"
: "${SPCS_IMAGE_REPO:?deploy.env must set SPCS_IMAGE_REPO}"
: "${SPCS_STD_WAREHOUSE:?deploy.env must set SPCS_STD_WAREHOUSE}"
: "${SPCS_INTERACTIVE_WAREHOUSE:?deploy.env must set SPCS_INTERACTIVE_WAREHOUSE}"

C="${SNOWFLAKE_CONNECTION}"

# ---------------------------------------------------------------------------
# Step 1: Deploy database objects via DCM (schemas, tables, dynamic tables)
# ---------------------------------------------------------------------------
# Order matters for clean deploys:
#   1. pre_deploy.sql  — creates DB, RAW schema, 6 Iceberg table DDLs
#   2. snow dcm deploy — creates schemas, RAW tables, DTs, warehouse, stage
#   3. Load parquet    — uploads seed data to stage, COPY INTO RAW tables
#   4. Seed Iceberg    — INSERT INTO *_ICEBERG SELECT * FROM RAW.*
#   5. post_deploy.sql — creates Interactive Tables + Interactive Warehouse
# ---------------------------------------------------------------------------
if [[ "${SKIP_DCM}" == "false" ]]; then
    echo "==> Step 1a: Running pre-deploy SQL (DB + Iceberg DDLs)..."
    snow sql -c "${C}" -f "${REPO_ROOT}/dcm/pre_deploy.sql" || true

    echo "==> Step 1b: Running snow dcm deploy (schemas, RAW tables, DTs)..."
    # Create DCM project if it doesn't exist (first deploy)
    (cd "${REPO_ROOT}/dcm" && snow dcm create -c "${C}" --target DEV 2>/dev/null || true)
    (cd "${REPO_ROOT}/dcm" && snow dcm deploy -c "${C}" --target DEV)

    echo "==> Step 1c: Loading seed data (parquet → stage → RAW tables)..."
    # Upload parquet files to internal stage
    for f in "${REPO_ROOT}"/data/output/*.parquet; do
        [[ -f "${f}" ]] || continue
        echo "    PUT ${f##*/}..."
        snow sql -c "${C}" -q "PUT 'file://${f}' @${SPCS_DATABASE}.RAW.BDC_DATA_STAGE AUTO_COMPRESS=FALSE OVERWRITE=TRUE" 2>/dev/null || true
    done

    # COPY INTO each RAW table from its matching parquet file.
    # Most tables work with MATCH_BY_COLUMN_NAME + USE_LOGICAL_TYPE = TRUE.
    # Tables with DATE columns (AGENTS, DEALERS, AGENT_DAILY_METRICS, TASKS) need
    # explicit SELECT transforms because parquet stores dates as epoch microseconds
    # which USE_LOGICAL_TYPE converts to timestamp strings ("2020-01-01 00:00:00.000")
    # that cannot auto-cast to DATE.
    echo "    COPY INTO RAW tables from stage (generic)..."
    for tbl in CAMPAIGNS CUSTOMERS VEHICLES SERVICE_HISTORY CALLS CALL_TRANSCRIPTS CALL_SCORES APPOINTMENTS TEXT_MESSAGES EMAIL_LOGS CALL_AI_ENRICHMENTS PIPELINE_STATUS; do
        LOWER_TBL=$(echo "${tbl}" | tr '[:upper:]' '[:lower:]')
        snow sql -c "${C}" -q "
            COPY INTO ${SPCS_DATABASE}.RAW.${tbl}
            FROM @${SPCS_DATABASE}.RAW.BDC_DATA_STAGE/${LOWER_TBL}.parquet
            FILE_FORMAT = (TYPE = PARQUET USE_LOGICAL_TYPE = TRUE)
            MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
            ON_ERROR = CONTINUE
        " 2>/dev/null || true
    done

    # DATE-column tables: explicit SELECT with TO_DATE() for DATE cols
    echo "    COPY INTO RAW tables from stage (DATE-column transforms)..."
    snow sql -c "${C}" -q "
        COPY INTO ${SPCS_DATABASE}.RAW.DEALERS
        FROM (SELECT \$1:DEALER_ID::VARCHAR, \$1:DEALER_NAME::VARCHAR, \$1:BRAND::VARCHAR,
                     \$1:CITY::VARCHAR, \$1:STATE::VARCHAR, \$1:ZIP_CODE::NUMBER(5,0),
                     \$1:PHONE::VARCHAR, TO_DATE(\$1:CREATED_AT::VARCHAR)
              FROM @${SPCS_DATABASE}.RAW.BDC_DATA_STAGE/dealers.parquet)
        FILE_FORMAT = (TYPE = PARQUET USE_LOGICAL_TYPE = TRUE)
    " 2>/dev/null || true

    snow sql -c "${C}" -q "
        COPY INTO ${SPCS_DATABASE}.RAW.AGENTS
        FROM (SELECT \$1:AGENT_ID::VARCHAR, \$1:DEALER_ID::VARCHAR, \$1:FIRST_NAME::VARCHAR,
                     \$1:LAST_NAME::VARCHAR, \$1:EMAIL::VARCHAR, \$1:PHONE::VARCHAR,
                     \$1:SKILL_TIER::VARCHAR, TO_DATE(\$1:HIRE_DATE::VARCHAR),
                     \$1:IS_ACTIVE::BOOLEAN, TO_DATE(\$1:CREATED_AT::VARCHAR)
              FROM @${SPCS_DATABASE}.RAW.BDC_DATA_STAGE/agents.parquet)
        FILE_FORMAT = (TYPE = PARQUET USE_LOGICAL_TYPE = TRUE)
    " 2>/dev/null || true

    snow sql -c "${C}" -q "
        COPY INTO ${SPCS_DATABASE}.RAW.AGENT_DAILY_METRICS
        FROM (SELECT \$1:METRIC_ID::VARCHAR, \$1:AGENT_ID::VARCHAR, \$1:DEALER_ID::VARCHAR,
                     TO_DATE(\$1:METRIC_DATE::VARCHAR), \$1:TOTAL_CALLS::NUMBER(2,0),
                     \$1:CONNECTED_CALLS::NUMBER(2,0), \$1:APPOINTMENTS_SET::NUMBER(2,0),
                     \$1:VOICEMAILS_LEFT::NUMBER(2,0), \$1:AVG_HANDLE_TIME_SECONDS::NUMBER(3,0),
                     \$1:TOTAL_TALK_TIME_SECONDS::NUMBER(5,0), \$1:CONVERSION_RATE::NUMBER(4,3),
                     \$1:AVG_CALL_SCORE::NUMBER(3,0), TO_DATE(\$1:CREATED_AT::VARCHAR)
              FROM @${SPCS_DATABASE}.RAW.BDC_DATA_STAGE/agent_daily_metrics.parquet)
        FILE_FORMAT = (TYPE = PARQUET USE_LOGICAL_TYPE = TRUE)
    " 2>/dev/null || true

    snow sql -c "${C}" -q "
        COPY INTO ${SPCS_DATABASE}.RAW.TASKS
        FROM (SELECT \$1:TASK_ID::VARCHAR, \$1:CALL_ID::VARCHAR, \$1:DEALER_ID::VARCHAR,
                     \$1:AGENT_ID::VARCHAR, \$1:CUSTOMER_ID::VARCHAR,
                     \$1:TASK_TYPE::VARCHAR, \$1:PRIORITY::VARCHAR, \$1:STATUS::VARCHAR,
                     TO_DATE(\$1:DUE_DATE::VARCHAR), TRY_TO_TIMESTAMP_NTZ(\$1:COMPLETED_AT::VARCHAR),
                     \$1:NOTES::VARCHAR, TRY_TO_TIMESTAMP_NTZ(\$1:CREATED_AT::VARCHAR)
              FROM @${SPCS_DATABASE}.RAW.BDC_DATA_STAGE/tasks.parquet)
        FILE_FORMAT = (TYPE = PARQUET USE_LOGICAL_TYPE = TRUE)
    " 2>/dev/null || true

    echo "==> Step 1d: Seeding Iceberg tables from RAW..."
    snow sql -c "${C}" -q "
        INSERT INTO ${SPCS_DATABASE}.RAW.CALLS_ICEBERG SELECT * FROM ${SPCS_DATABASE}.RAW.CALLS;
        INSERT INTO ${SPCS_DATABASE}.RAW.CALL_TRANSCRIPTS_ICEBERG SELECT * FROM ${SPCS_DATABASE}.RAW.CALL_TRANSCRIPTS;
        INSERT INTO ${SPCS_DATABASE}.RAW.CALL_SCORES_ICEBERG SELECT * FROM ${SPCS_DATABASE}.RAW.CALL_SCORES;
        INSERT INTO ${SPCS_DATABASE}.RAW.CALL_AI_ENRICHMENTS_ICEBERG SELECT * FROM ${SPCS_DATABASE}.RAW.CALL_AI_ENRICHMENTS;
        INSERT INTO ${SPCS_DATABASE}.RAW.APPOINTMENTS_ICEBERG SELECT * FROM ${SPCS_DATABASE}.RAW.APPOINTMENTS;
        INSERT INTO ${SPCS_DATABASE}.RAW.AGENT_DAILY_METRICS_ICEBERG SELECT * FROM ${SPCS_DATABASE}.RAW.AGENT_DAILY_METRICS;
    " || true

    echo "==> Step 1e: Running post-deploy SQL (Interactive Tables + WH)..."
    snow sql -c "${C}" -f "${REPO_ROOT}/dcm/post_deploy.sql" || true

    echo "==> Step 1f: Creating daily task + Cortex objects..."
    snow sql -c "${C}" -f "${REPO_ROOT}/sql/04-daily-task.sql" || true
    snow sql -c "${C}" -f "${REPO_ROOT}/sql/03-cortex-objects.sql" || true

    echo "    DCM deploy complete."
fi

if [[ "${SKIP_IMAGES}" == "true" ]]; then
    echo "==> Skipping image build + service deploy (--dcm flag)."
    exit 0
fi

# ---------------------------------------------------------------------------
# Step 2: Ensure SPCS infrastructure exists (schema, image repo, pool, EAI)
# ---------------------------------------------------------------------------
# When running --images only (SKIP_DCM=true), the SPCS schema and image repo
# may not exist (e.g., after a nuclear teardown). setup.sql is idempotent.
echo "==> Ensuring SPCS infrastructure exists..."
snow sql -c "${C}" -f "${REPO_ROOT}/deploy/spcs/setup.sql" 2>/dev/null || true

# ---------------------------------------------------------------------------
# Step 3: Resolve image registry URL
# ---------------------------------------------------------------------------
echo "==> Resolving image registry URL..."
REGISTRY_URL=$(snow spcs image-registry url -c "${C}" 2>/dev/null | tr -d '"')
if [[ -z "${REGISTRY_URL}" ]]; then
    echo "ERROR: Could not retrieve image registry URL. Ensure setup.sql has been run." >&2
    exit 1
fi
IMAGE_BASE="${REGISTRY_URL}/$(echo "${SPCS_DATABASE}/${SPCS_SCHEMA}/${SPCS_IMAGE_REPO}" | tr '[:upper:]' '[:lower:]')"
echo "    Registry: ${IMAGE_BASE}"

# ---------------------------------------------------------------------------
# Step 4: Docker login to Snowflake registry
# ---------------------------------------------------------------------------
echo "==> Logging in to Snowflake image registry..."
snow spcs image-registry login -c "${C}"

# ---------------------------------------------------------------------------
# Step 5: Build, tag, and push all images with unique tags
# ---------------------------------------------------------------------------
TAG="v$(date +%s)"
echo "==> Image tag: ${TAG}"

build_and_push() {
    local name="$1"
    local context="$2"
    local image="${IMAGE_BASE}/${name}:${TAG}"
    echo "==> Building ${name}..."
    docker build --platform linux/amd64 -t "${image}" "${context}"
    echo "==> Pushing ${name}..."
    docker push "${image}"
}

build_and_push "frontend" "${REPO_ROOT}/frontend"
build_and_push "backend"  "${REPO_ROOT}/backend"
build_and_push "router"   "${REPO_ROOT}/router"

# ---------------------------------------------------------------------------
# Step 6: Generate service spec (matches currently deployed spec)
# ---------------------------------------------------------------------------
# Image paths use lowercase DB/SCHEMA/REPO as required by SPCS registry
IMG_PATH="/$(echo "${SPCS_DATABASE}/${SPCS_SCHEMA}/${SPCS_IMAGE_REPO}" | tr '[:upper:]' '[:lower:]')"

SPEC=$(cat <<YAML
spec:
  containers:
    - name: router
      image: ${IMG_PATH}/router:${TAG}
      resources:
        requests: { cpu: "0.2", memory: 256M }
        limits:   { cpu: "1", memory: 512M }
      env:
        BE_SERVER: "localhost:8081"
        FE_SERVER: "localhost:5173"
      readinessProbe:
        port: 8000
        path: /router-health

    - name: backend
      image: ${IMG_PATH}/backend:${TAG}
      resources:
        requests: { cpu: "0.5", memory: 512M }
        limits:   { cpu: "1", memory: 2G }
      env:
        SNOWFLAKE_DATABASE: ${SPCS_DATABASE}
        SNOWFLAKE_WAREHOUSE: ${SPCS_STD_WAREHOUSE}
        SNOWFLAKE_STD_WAREHOUSE: ${SPCS_STD_WAREHOUSE}
        SNOWFLAKE_INTERACTIVE_WAREHOUSE: ${SPCS_INTERACTIVE_WAREHOUSE}
      readinessProbe:
        port: 8081
        path: /health

    - name: frontend
      image: ${IMG_PATH}/frontend:${TAG}
      resources:
        requests: { cpu: "0.2", memory: 256M }
        limits:   { cpu: "1", memory: 512M }
      readinessProbe:
        port: 5173
        path: /

  endpoints:
    - name: main
      port: 8000
      public: true
YAML
)

# ---------------------------------------------------------------------------
# Step 7: Deploy service — ALTER in-place (preserves endpoint URL)
# ---------------------------------------------------------------------------
echo "==> Deploying SPCS service ${SPCS_SERVICE_NAME}..."

FQ_SERVICE="${SPCS_DATABASE}.${SPCS_SCHEMA}.${SPCS_SERVICE_NAME}"

# Check if service already exists (use --format json to avoid header false-positives)
EXISTING=$(snow sql -c "${C}" -q "SHOW SERVICES LIKE '${SPCS_SERVICE_NAME}' IN SCHEMA ${SPCS_DATABASE}.${SPCS_SCHEMA}" --format json 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo 0)

if [[ "${EXISTING}" -gt 0 ]]; then
    # ALTER SERVICE in-place: SUSPEND → update spec → RESUME
    # This preserves the endpoint URL (never DROP/CREATE)
    echo "    Suspending service..."
    snow sql -c "${C}" -q "ALTER SERVICE ${FQ_SERVICE} SUSPEND" 2>/dev/null || true
    sleep 5

    echo "    Updating service spec..."
    snow sql -c "${C}" -q "ALTER SERVICE ${FQ_SERVICE} FROM SPECIFICATION \$\$
${SPEC}
\$\$"

    echo "    Resuming service..."
    snow sql -c "${C}" -q "ALTER SERVICE ${FQ_SERVICE} RESUME"
else
    # First deploy — CREATE SERVICE via SQL (includes EAI for outbound network)
    echo "    Creating new service (first deploy)..."
    snow sql -c "${C}" -q "
        CREATE SERVICE ${FQ_SERVICE}
            IN COMPUTE POOL ${SPCS_COMPUTE_POOL}
            MIN_INSTANCES = 1
            MAX_INSTANCES = 1
            EXTERNAL_ACCESS_INTEGRATIONS = (${SPCS_EAI})
            FROM SPECIFICATION \$\$
${SPEC}
\$\$
    "
fi

# ---------------------------------------------------------------------------
# Step 8: Wait for service to reach READY state
# ---------------------------------------------------------------------------
echo "==> Waiting for service to reach READY state (timeout: 5 min)..."
TIMEOUT=300
ELAPSED=0
INTERVAL=10
while [[ ${ELAPSED} -lt ${TIMEOUT} ]]; do
    STATUS=$(snow sql -c "${C}" --format json -q "SELECT SYSTEM\$GET_SERVICE_STATUS('${FQ_SERVICE}')" 2>/dev/null \
        | python3 -c "
import sys, json
try:
    rows = json.loads(sys.stdin.read())
    svc_json = list(rows[0].values())[0] if rows else ''
    containers = json.loads(svc_json) if svc_json else []
    statuses = [c.get('status', 'UNKNOWN') for c in containers]
    print(' '.join(statuses) if statuses else 'UNKNOWN')
except Exception:
    print('UNKNOWN')
" 2>/dev/null || echo "UNKNOWN")
    if echo "${STATUS}" | grep -q "READY"; then
        echo "    Service is READY."
        break
    fi
    echo "    Status: ${STATUS} (${ELAPSED}s elapsed)"
    sleep "${INTERVAL}"
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [[ ${ELAPSED} -ge ${TIMEOUT} ]]; then
    echo "WARNING: Timed out waiting for READY state. Check logs with:"
    echo "  snow spcs service logs ${SPCS_SERVICE_NAME} -c ${C} --container-name backend --database ${SPCS_DATABASE} --schema ${SPCS_SCHEMA}"
fi

# ---------------------------------------------------------------------------
# Step 9: Print endpoint URL
# ---------------------------------------------------------------------------
echo ""
echo "==> Fetching endpoint URL..."
ENDPOINT=$(snow sql -c "${C}" --format json -q "SHOW ENDPOINTS IN SERVICE ${FQ_SERVICE}" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    rows = json.loads(sys.stdin.read())
    for r in rows:
        if r.get('name') == 'main':
            print(r.get('ingress_url', '(not yet available)'))
            break
    else:
        print('(not yet available)')
except Exception:
    print('(not yet available)')
" 2>/dev/null || echo "(not yet available)")

echo ""
echo "======================================================"
echo "  BDC Agent Coaching Dashboard"
echo "  Tag:      ${TAG}"
echo "  Endpoint: https://${ENDPOINT}"
echo "======================================================"
