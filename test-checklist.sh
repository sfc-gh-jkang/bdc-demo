#!/usr/bin/env bash
# test-checklist.sh — Hit every API endpoint to verify the BDC demo is working.
#
# Usage:
#   bash test-checklist.sh                                    # local: http://localhost:8081
#   bash test-checklist.sh http://localhost:8081               # explicit local backend
#   bash test-checklist.sh https://your-spcs-endpoint.app     # SPCS (needs --token)
#   bash test-checklist.sh --spcs                             # SPCS endpoint from deploy.env
#   bash test-checklist.sh --spcs --token "sn-abc123..."      # SPCS with auth token
#
# SPCS Auth:
#   SPCS public endpoints require Snowflake SSO. To test via curl, grab the
#   "token" cookie from your browser (DevTools → Application → Cookies) after
#   logging in, then pass it with --token.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
BASE_URL=""
SPCS_MODE=false
AUTH_TOKEN=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --spcs)      SPCS_MODE=true; shift ;;
        --token)     AUTH_TOKEN="$2"; shift 2 ;;
        --token=*)   AUTH_TOKEN="${1#--token=}"; shift ;;
        http*)       BASE_URL="${1%/}"; shift ;;
        *)           echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Resolve base URL
# ---------------------------------------------------------------------------
if [[ "${SPCS_MODE}" == "true" && -z "${BASE_URL}" ]]; then
    ENV_FILE="${REPO_ROOT}/deploy/deploy.env"
    if [[ -f "${ENV_FILE}" ]]; then
        source "${ENV_FILE}"
        C="${SNOWFLAKE_CONNECTION:-aws_spcs}"
        DB="${SPCS_DATABASE:-BDC_DEMO}"
        SCH="${SPCS_SCHEMA:-SPCS}"
        SVC="${SPCS_SERVICE_NAME:-BDC_COACHING_SERVICE}"
        FQ="${DB}.${SCH}.${SVC}"
        ENDPOINT=$(snow sql -c "${C}" -q \
            "SELECT value:ingress_url::string FROM TABLE(FLATTEN(input => PARSE_JSON(SYSTEM\$GET_SERVICE_STATUS('${FQ}')), path => 'endpoints')) WHERE value:name = 'main'" \
            2>/dev/null | grep -v "^$" | tail -1 | tr -d '"' || echo "")
        if [[ -n "${ENDPOINT}" ]]; then
            BASE_URL="https://${ENDPOINT}"
        else
            echo "ERROR: Could not resolve endpoint URL." >&2
            exit 1
        fi
    else
        echo "ERROR: deploy/deploy.env not found." >&2
        exit 1
    fi
fi

# Default to local backend
if [[ -z "${BASE_URL}" ]]; then
    BASE_URL="http://localhost:8081"
fi

# Build curl auth args
CURL_AUTH=""
if [[ -n "${AUTH_TOKEN}" ]]; then
    CURL_AUTH="-b token=${AUTH_TOKEN}"
fi

echo "============================================"
echo "  BDC Demo Test Checklist"
echo "  Base URL: ${BASE_URL}"
echo "============================================"
echo ""

PASS=0
FAIL=0
TOTAL=0

check() {
    local label="$1"
    local method="$2"
    local path="$3"
    local body="${4:-}"
    TOTAL=$((TOTAL + 1))

    local url="${BASE_URL}${path}"
    local http_code
    local response

    if [[ "${method}" == "GET" ]]; then
        response=$(curl -s -w "\n%{http_code}" --max-time 30 ${CURL_AUTH} "${url}" 2>/dev/null || echo -e "\n000")
    elif [[ "${method}" == "POST" ]]; then
        response=$(curl -s -w "\n%{http_code}" --max-time 60 -X POST \
            -H "Content-Type: application/json" \
            ${CURL_AUTH} -d "${body}" "${url}" 2>/dev/null || echo -e "\n000")
    elif [[ "${method}" == "SSE" ]]; then
        # For SSE endpoints, just check we get a 200 and some data
        http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -X POST \
            -H "Content-Type: application/json" \
            ${CURL_AUTH} -d "${body}" "${url}" 2>/dev/null || echo "000")
        if [[ "${http_code}" =~ ^2 ]]; then
            echo "  [PASS] ${label} (HTTP ${http_code}, SSE stream)"
            PASS=$((PASS + 1))
        else
            echo "  [FAIL] ${label} (HTTP ${http_code})"
            FAIL=$((FAIL + 1))
        fi
        return
    fi

    http_code=$(echo "${response}" | tail -1)
    local body_preview
    body_preview=$(echo "${response}" | sed '$d' | head -1 | cut -c1-120)

    if [[ "${http_code}" =~ ^2 ]]; then
        echo "  [PASS] ${label} (HTTP ${http_code})"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] ${label} (HTTP ${http_code}) ${body_preview}"
        FAIL=$((FAIL + 1))
    fi
}

# ---------------------------------------------------------------------------
# Resolve real IDs from the API (avoids hardcoding AGT-001 etc.)
# ---------------------------------------------------------------------------
echo "--- Resolving test IDs ---"
AGENT_JSON=$(curl -s --max-time 10 ${CURL_AUTH} "${BASE_URL}/api/agents" 2>/dev/null || echo "{}")
SAMPLE_AGENT=$(echo "${AGENT_JSON}" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    agents=d.get('agents',d) if isinstance(d,dict) else d
    print(agents[0]['agent_id'] if agents else '')
except: print('')
" 2>/dev/null)
SAMPLE_DEALER=$(echo "${AGENT_JSON}" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    agents=d.get('agents',d) if isinstance(d,dict) else d
    print(agents[0]['dealer_id'] if agents else '')
except: print('')
" 2>/dev/null)

CALLS_JSON=$(curl -s --max-time 10 ${CURL_AUTH} "${BASE_URL}/api/calls" 2>/dev/null || echo "{}")
SAMPLE_CALL=$(echo "${CALLS_JSON}" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    calls=d.get('calls',d) if isinstance(d,dict) else d
    print(calls[0]['call_id'] if calls else '')
except: print('')
" 2>/dev/null)

echo "  Agent: ${SAMPLE_AGENT:-<none>}  Dealer: ${SAMPLE_DEALER:-<none>}  Call: ${SAMPLE_CALL:-<none>}"
echo ""

# ---------------------------------------------------------------------------
# Frontend (only when testing through the router, not direct backend)
# ---------------------------------------------------------------------------
if [[ "${BASE_URL}" != *":8081"* ]]; then
    echo "--- Frontend ---"
    check "Homepage loads"                   GET  "/"
    echo ""
    echo "--- Router Health ---"
    check "Router health"                    GET  "/router-health"
else
    echo "--- Frontend: SKIPPED (direct backend mode) ---"
fi

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
echo ""
echo "--- Backend Health ---"
check "Backend health"                   GET  "/health"

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
echo ""
echo "--- Dashboard API ---"
check "Dashboard metrics"                GET  "/api/dashboard"
check "Dashboard with dealer filter"     GET  "/api/dashboard?dealer_id=${SAMPLE_DEALER:-DLR001}"

# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------
echo ""
echo "--- Leaderboard API ---"
check "Leaderboard (all dealers)"        GET  "/api/leaderboard"
check "Leaderboard (single dealer)"      GET  "/api/leaderboard?dealer_id=${SAMPLE_DEALER:-DLR001}"

# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------
echo ""
echo "--- Agents API ---"
check "Agent list"                       GET  "/api/agents"
check "Agent list (filtered)"            GET  "/api/agents?dealer_id=${SAMPLE_DEALER:-DLR001}"
if [[ -n "${SAMPLE_AGENT}" ]]; then
    check "Agent detail"                 GET  "/api/agents/${SAMPLE_AGENT}"
else
    echo "  [SKIP] Agent detail (no agent ID resolved)"
fi

# ---------------------------------------------------------------------------
# Calls
# ---------------------------------------------------------------------------
echo ""
echo "--- Calls API ---"
check "Call list"                        GET  "/api/calls"
check "Call list (filtered)"             GET  "/api/calls?agent_id=${SAMPLE_AGENT:-AGT001}"
if [[ -n "${SAMPLE_CALL}" ]]; then
    check "Call detail"                  GET  "/api/calls/${SAMPLE_CALL}"
else
    echo "  [SKIP] Call detail (no call ID resolved)"
fi

# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------
echo ""
echo "--- Pipeline API ---"
check "Pipeline status"                  GET  "/api/pipeline-status"

# ---------------------------------------------------------------------------
# AI / Cortex Agent
# ---------------------------------------------------------------------------
echo ""
echo "--- AI / Cortex Agent ---"
if [[ -n "${SAMPLE_AGENT}" ]]; then
    check "Coaching summary (buffered)"  GET  "/api/agents/${SAMPLE_AGENT}/summary"
    check "Coaching chat (SSE stream)"   SSE  "/api/agents/${SAMPLE_AGENT}/chat" \
        '{"message":"What are this agents top strengths?","history":[]}'
else
    echo "  [SKIP] AI endpoints (no agent ID resolved)"
fi

# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Results: ${PASS}/${TOTAL} passed, ${FAIL} failed"
echo "============================================"

if [[ ${FAIL} -gt 0 ]]; then
    exit 1
fi
