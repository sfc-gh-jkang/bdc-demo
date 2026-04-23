-- =============================================================================
-- BDC Agent Coaching Demo — Full SQL Deploy
-- =============================================================================
-- Creates ALL Snowflake objects from scratch. Use this for a clean-room setup
-- when DCM is not available, or as a reference for what DCM manages.
--
-- Run order:
--   1. This script (creates database, schemas, tables, DTs, search, agent)
--   2. Load data into RAW tables (data/generator.py or COPY INTO from stage)
--   3. deploy/spcs/setup.sql (compute pool, image repo — one-time)
--   4. deploy/spcs/deploy-spcs.sh (build + push + service)
--
-- NOTE: If using DCM, prefer `snow dcm deploy` instead. This script is the
-- manual equivalent of pre_deploy.sql + DCM definitions + post_deploy.sql +
-- sql/03-cortex-objects.sql combined into one file.
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- =============================================================================
-- 1. DATABASE + SCHEMAS
-- =============================================================================

CREATE DATABASE IF NOT EXISTS BDC_DEMO
    COMMENT = 'BDC Agent Coaching Demo';

CREATE SCHEMA IF NOT EXISTS BDC_DEMO.RAW
    COMMENT = 'Landing zone — source tables from pg_lake / direct load';

CREATE SCHEMA IF NOT EXISTS BDC_DEMO.ANALYTICS
    COMMENT = 'Dynamic tables with Cortex AI enrichment';

CREATE SCHEMA IF NOT EXISTS BDC_DEMO.COACHING
    COMMENT = 'Serving layer — Interactive Tables, Cortex Search, Cortex Agent';

CREATE SCHEMA IF NOT EXISTS BDC_DEMO.SPCS
    COMMENT = 'Snowpark Container Services — compute pool, service, images';

-- =============================================================================
-- 2. WAREHOUSE
-- =============================================================================

CREATE WAREHOUSE IF NOT EXISTS BDC_STD_WH
    WAREHOUSE_SIZE = 'XSMALL'
    AUTO_SUSPEND = 120
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Compute for dynamic table refreshes and data loading';

-- =============================================================================
-- 3. INTERNAL STAGE (for data loading)
-- =============================================================================

CREATE STAGE IF NOT EXISTS BDC_DEMO.RAW.BDC_DATA_STAGE
    COMMENT = 'Internal stage for loading seed data files';

-- =============================================================================
-- 4. RAW TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.DEALERS (
    DEALER_ID       VARCHAR NOT NULL,
    DEALER_NAME     VARCHAR NOT NULL,
    BRAND           VARCHAR NOT NULL,
    CITY            VARCHAR NOT NULL,
    STATE           VARCHAR NOT NULL,
    ZIP_CODE        NUMBER(5,0),
    PHONE           VARCHAR,
    CREATED_AT      DATE
) CHANGE_TRACKING = TRUE
  COMMENT = 'Auto dealerships — 5 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.CAMPAIGNS (
    CAMPAIGN_ID     VARCHAR NOT NULL,
    DEALER_ID       VARCHAR NOT NULL,
    CAMPAIGN_NAME   VARCHAR NOT NULL,
    CAMPAIGN_TYPE   VARCHAR NOT NULL,
    START_DATE      DATE NOT NULL,
    END_DATE        DATE,
    TARGET_COUNT    NUMBER NOT NULL DEFAULT 0,
    IS_ACTIVE       BOOLEAN NOT NULL DEFAULT TRUE,
    CREATED_AT      DATE
) CHANGE_TRACKING = TRUE
  COMMENT = 'Outbound/inbound call campaigns — 25 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.AGENTS (
    AGENT_ID        VARCHAR NOT NULL,
    DEALER_ID       VARCHAR NOT NULL,
    FIRST_NAME      VARCHAR NOT NULL,
    LAST_NAME       VARCHAR NOT NULL,
    EMAIL           VARCHAR NOT NULL,
    PHONE           VARCHAR,
    SKILL_TIER      VARCHAR NOT NULL,
    HIRE_DATE       DATE NOT NULL,
    IS_ACTIVE       BOOLEAN NOT NULL DEFAULT TRUE,
    CREATED_AT      DATE
) CHANGE_TRACKING = TRUE
  COMMENT = 'BDC agents — 30 rows (6 per dealer)';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.CUSTOMERS (
    CUSTOMER_ID     VARCHAR NOT NULL,
    FIRST_NAME      VARCHAR NOT NULL,
    LAST_NAME       VARCHAR NOT NULL,
    EMAIL           VARCHAR,
    PHONE           VARCHAR,
    CITY            VARCHAR,
    STATE           VARCHAR,
    ZIP_CODE        NUMBER(5,0),
    OPT_IN_SMS      BOOLEAN NOT NULL DEFAULT TRUE,
    OPT_IN_EMAIL    BOOLEAN NOT NULL DEFAULT TRUE,
    DO_NOT_CALL     BOOLEAN NOT NULL DEFAULT FALSE,
    CREATED_AT      DATE
) CHANGE_TRACKING = TRUE
  COMMENT = 'Vehicle owners and prospects — 2000 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.VEHICLES (
    VEHICLE_ID      VARCHAR NOT NULL,
    CUSTOMER_ID     VARCHAR NOT NULL,
    DEALER_ID       VARCHAR NOT NULL,
    VIN             VARCHAR NOT NULL,
    YEAR            NUMBER NOT NULL,
    MAKE            VARCHAR NOT NULL,
    MODEL           VARCHAR NOT NULL,
    TRIM            VARCHAR,
    COLOR           VARCHAR,
    MILEAGE         NUMBER NOT NULL DEFAULT 0,
    PURCHASE_DATE   DATE,
    IS_LEASE        BOOLEAN NOT NULL DEFAULT FALSE,
    LEASE_END_DATE  DATE,
    CREATED_AT      DATE
) CHANGE_TRACKING = TRUE
  COMMENT = 'Customer vehicles — 2500 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.SERVICE_HISTORY (
    SERVICE_ID              VARCHAR NOT NULL,
    VEHICLE_ID              VARCHAR NOT NULL,
    DEALER_ID               VARCHAR NOT NULL,
    SERVICE_DATE            DATE NOT NULL,
    SERVICE_TYPE            VARCHAR NOT NULL,
    MILEAGE_AT_SERVICE      NUMBER NOT NULL,
    LABOR_COST              NUMBER(10,2),
    PARTS_COST              NUMBER(10,2),
    TOTAL_COST              NUMBER(10,2) NOT NULL DEFAULT 0,
    ADVISOR_NAME            VARCHAR,
    RO_NUMBER               VARCHAR,
    CSI_SCORE               NUMBER,
    CREATED_AT              DATE
) CHANGE_TRACKING = TRUE
  COMMENT = 'Vehicle service records — 10000 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.CALLS (
    CALL_ID                 VARCHAR NOT NULL,
    DEALER_ID               VARCHAR NOT NULL,
    AGENT_ID                VARCHAR NOT NULL,
    CUSTOMER_ID             VARCHAR NOT NULL,
    CAMPAIGN_ID             VARCHAR,
    CALL_DATETIME           TIMESTAMP_NTZ NOT NULL,
    CALL_DATE               DATE NOT NULL,
    DURATION_SECONDS        NUMBER(3,0) NOT NULL,
    DISPOSITION             VARCHAR NOT NULL,
    DIRECTION               VARCHAR NOT NULL,
    CALL_TYPE               VARCHAR,
    RECORDING_URL           VARCHAR,
    CREATED_AT              TIMESTAMP_NTZ
) CHANGE_TRACKING = TRUE
  COMMENT = 'Phone calls between agents and customers — 15000 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.CALL_TRANSCRIPTS (
    TRANSCRIPT_ID           VARCHAR NOT NULL,
    CALL_ID                 VARCHAR NOT NULL,
    TRANSCRIPT_JSON         VARCHAR NOT NULL,
    TRANSCRIPT_TEXT         VARCHAR NOT NULL,
    WORD_COUNT              NUMBER(3,0) NOT NULL DEFAULT 0,
    SCENARIO_TEMPLATE       VARCHAR,
    CREATED_AT              TIMESTAMP_NTZ
) CHANGE_TRACKING = TRUE
  COMMENT = 'Multi-turn call transcripts — 15000 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.CALL_SCORES (
    SCORE_ID                VARCHAR NOT NULL,
    CALL_ID                 VARCHAR NOT NULL,
    AGENT_ID                VARCHAR NOT NULL,
    GREETING                NUMBER(3,0),
    ACTIVE_LISTENING        NUMBER(3,0),
    OBJECTION_HANDLING      NUMBER(3,0),
    PRODUCT_KNOWLEDGE       NUMBER(3,0),
    CLOSING                 NUMBER(3,0),
    PROFESSIONALISM         NUMBER(3,0),
    OVERALL_SCORE           NUMBER(2,0),
    SCORED_BY               VARCHAR,
    NOTES                   VARCHAR,
    CREATED_AT              TIMESTAMP_NTZ
) CHANGE_TRACKING = TRUE
  COMMENT = 'AI-derived call quality scores — 15000 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.APPOINTMENTS (
    APPOINTMENT_ID          VARCHAR NOT NULL,
    CALL_ID                 VARCHAR NOT NULL,
    DEALER_ID               VARCHAR NOT NULL,
    AGENT_ID                VARCHAR NOT NULL,
    CUSTOMER_ID             VARCHAR NOT NULL,
    APPOINTMENT_DATETIME    TIMESTAMP_NTZ NOT NULL,
    APPOINTMENT_DATE        DATE NOT NULL,
    APPOINTMENT_TYPE        VARCHAR NOT NULL,
    STATUS                  VARCHAR NOT NULL DEFAULT 'confirmed',
    DURATION_MINUTES        NUMBER(3,0),
    NOTES                   VARCHAR,
    CREATED_AT              TIMESTAMP_NTZ
) CHANGE_TRACKING = TRUE
  COMMENT = 'Service/sales appointments — 4500 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.TASKS (
    TASK_ID                 VARCHAR NOT NULL,
    CALL_ID                 VARCHAR,
    DEALER_ID               VARCHAR NOT NULL,
    AGENT_ID                VARCHAR NOT NULL,
    CUSTOMER_ID             VARCHAR NOT NULL,
    TASK_TYPE               VARCHAR NOT NULL,
    PRIORITY                VARCHAR,
    STATUS                  VARCHAR NOT NULL DEFAULT 'pending',
    DUE_DATE                DATE NOT NULL,
    COMPLETED_AT            TIMESTAMP_NTZ,
    NOTES                   VARCHAR,
    CREATED_AT              TIMESTAMP_NTZ
) CHANGE_TRACKING = TRUE
  COMMENT = 'Agent follow-up tasks — 8000 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.TEXT_MESSAGES (
    MESSAGE_ID              VARCHAR NOT NULL,
    DEALER_ID               VARCHAR NOT NULL,
    CUSTOMER_ID             VARCHAR NOT NULL,
    CALL_ID                 VARCHAR,
    DIRECTION               VARCHAR NOT NULL DEFAULT 'outbound',
    BODY                    VARCHAR NOT NULL,
    STATUS                  VARCHAR NOT NULL DEFAULT 'delivered',
    SENT_AT                 TIMESTAMP_NTZ NOT NULL,
    CREATED_AT              TIMESTAMP_NTZ
) CHANGE_TRACKING = TRUE
  COMMENT = 'SMS messages — 5000 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.EMAIL_LOGS (
    EMAIL_ID                VARCHAR NOT NULL,
    DEALER_ID               VARCHAR NOT NULL,
    CUSTOMER_ID             VARCHAR NOT NULL,
    CALL_ID                 VARCHAR,
    TO_EMAIL                VARCHAR NOT NULL,
    FROM_EMAIL              VARCHAR,
    SUBJECT                 VARCHAR NOT NULL,
    STATUS                  VARCHAR NOT NULL DEFAULT 'delivered',
    OPENED_AT               TIMESTAMP_NTZ,
    SENT_AT                 TIMESTAMP_NTZ NOT NULL,
    CREATED_AT              TIMESTAMP_NTZ
) CHANGE_TRACKING = TRUE
  COMMENT = 'Email campaign logs — 3000 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.CALL_AI_ENRICHMENTS (
    ENRICHMENT_ID               VARCHAR NOT NULL,
    CALL_ID                     VARCHAR NOT NULL,
    SENTIMENT_SCORE             NUMBER(4,3),
    SENTIMENT_LABEL             VARCHAR,
    CALL_SUMMARY                VARCHAR,
    DISPOSITION_CLASS           VARCHAR,
    FOLLOW_UP_ACTION            VARCHAR,
    CUSTOMER_OBJECTIONS         VARCHAR,
    APPOINTMENT_DATE_EXTRACTED  DATE,
    MODEL_VERSION               VARCHAR,
    PROCESSED_AT                TIMESTAMP_NTZ,
    CREATED_AT                  TIMESTAMP_NTZ
) CHANGE_TRACKING = TRUE
  COMMENT = 'LLM-generated call enrichments — 15000 rows';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.AGENT_DAILY_METRICS (
    METRIC_ID                   VARCHAR NOT NULL,
    AGENT_ID                    VARCHAR NOT NULL,
    DEALER_ID                   VARCHAR NOT NULL,
    METRIC_DATE                 DATE NOT NULL,
    TOTAL_CALLS                 NUMBER(2,0),
    CONNECTED_CALLS             NUMBER(2,0),
    APPOINTMENTS_SET            NUMBER(2,0),
    VOICEMAILS_LEFT             NUMBER(2,0),
    AVG_HANDLE_TIME_SECONDS     NUMBER(3,0),
    TOTAL_TALK_TIME_SECONDS     NUMBER(5,0),
    CONVERSION_RATE             NUMBER(4,3),
    AVG_CALL_SCORE              NUMBER(3,0),
    CREATED_AT                  DATE
) CHANGE_TRACKING = TRUE
  COMMENT = 'Pre-aggregated agent performance metrics by day';

CREATE TABLE IF NOT EXISTS BDC_DEMO.RAW.PIPELINE_STATUS (
    PIPELINE_ID         VARCHAR NOT NULL,
    PIPELINE_NAME       VARCHAR NOT NULL,
    STATUS              VARCHAR NOT NULL,
    DESCRIPTION         VARCHAR,
    LAST_RUN_AT         TIMESTAMP_NTZ,
    NEXT_RUN_AT         TIMESTAMP_NTZ,
    RECORDS_PROCESSED   NUMBER,
    ERROR_MESSAGE       VARCHAR,
    CREATED_AT          TIMESTAMP_NTZ
) COMMENT = 'Pipeline stage health — 6 rows';

-- =============================================================================
-- 5. DYNAMIC TABLES (ANALYTICS schema)
-- =============================================================================

CREATE OR REPLACE DYNAMIC TABLE BDC_DEMO.ANALYTICS.CALL_AI_ENRICHMENTS
    WAREHOUSE = 'BDC_STD_WH'
    TARGET_LAG = 'DOWNSTREAM'
    INITIALIZE = 'ON_CREATE'
AS
SELECT
    e.ENRICHMENT_ID, e.CALL_ID, c.AGENT_ID, c.DEALER_ID, c.CUSTOMER_ID,
    c.CALL_DATE, c.DURATION_SECONDS, c.DISPOSITION, c.DIRECTION,
    e.SENTIMENT_SCORE, e.SENTIMENT_LABEL, e.CALL_SUMMARY,
    e.DISPOSITION_CLASS, e.FOLLOW_UP_ACTION, e.CUSTOMER_OBJECTIONS,
    e.APPOINTMENT_DATE_EXTRACTED, t.TRANSCRIPT_TEXT, t.WORD_COUNT
FROM BDC_DEMO.RAW.CALL_AI_ENRICHMENTS e
JOIN BDC_DEMO.RAW.CALLS c ON e.CALL_ID = c.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_TRANSCRIPTS t ON e.CALL_ID = t.CALL_ID;

CREATE OR REPLACE DYNAMIC TABLE BDC_DEMO.ANALYTICS.AGENT_DAILY_METRICS
    WAREHOUSE = 'BDC_STD_WH'
    TARGET_LAG = 'DOWNSTREAM'
    INITIALIZE = 'ON_CREATE'
AS
SELECT
    a.AGENT_ID, a.DEALER_ID,
    a.FIRST_NAME || ' ' || a.LAST_NAME AS AGENT_NAME, a.SKILL_TIER,
    d.DEALER_NAME, m.METRIC_DATE,
    m.TOTAL_CALLS, m.CONNECTED_CALLS, m.APPOINTMENTS_SET, m.VOICEMAILS_LEFT,
    m.AVG_HANDLE_TIME_SECONDS, m.TOTAL_TALK_TIME_SECONDS,
    m.CONVERSION_RATE, m.AVG_CALL_SCORE
FROM BDC_DEMO.RAW.AGENT_DAILY_METRICS m
JOIN BDC_DEMO.RAW.AGENTS a ON m.AGENT_ID = a.AGENT_ID
JOIN BDC_DEMO.RAW.DEALERS d ON a.DEALER_ID = d.DEALER_ID;

CREATE OR REPLACE DYNAMIC TABLE BDC_DEMO.ANALYTICS.DASHBOARD_METRICS
    WAREHOUSE = 'BDC_STD_WH'
    TARGET_LAG = '5 minutes'
    INITIALIZE = 'ON_CREATE'
AS
SELECT
    d.DEALER_ID, d.DEALER_NAME, d.BRAND,
    COUNT(c.CALL_ID)                                                        AS TOTAL_CALLS,
    COUNT(DISTINCT c.AGENT_ID)                                              AS ACTIVE_AGENTS,
    AVG(c.DURATION_SECONDS)                                                 AS AVG_CALL_DURATION,
    COUNT(CASE WHEN e.DISPOSITION_CLASS IN ('service_appointment', 'sales_appointment') THEN 1 END)
                                                                            AS APPOINTMENTS_SET,
    COUNT(CASE WHEN e.DISPOSITION_CLASS IN ('service_appointment', 'sales_appointment') THEN 1 END)::FLOAT
        / NULLIF(COUNT(c.CALL_ID), 0)                                       AS CONVERSION_RATE,
    AVG(e.SENTIMENT_SCORE)                                                  AS AVG_SENTIMENT,
    AVG(s.OVERALL_SCORE)                                                    AS AVG_CALL_SCORE,
    COUNT(DISTINCT c.CUSTOMER_ID)                                           AS UNIQUE_CUSTOMERS,
    SUM(c.DURATION_SECONDS)                                                 AS TOTAL_TALK_TIME_SECONDS
FROM BDC_DEMO.RAW.DEALERS d
JOIN BDC_DEMO.RAW.CALLS c ON d.DEALER_ID = c.DEALER_ID
LEFT JOIN BDC_DEMO.RAW.CALL_AI_ENRICHMENTS e ON c.CALL_ID = e.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_SCORES s ON c.CALL_ID = s.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CUSTOMERS cu ON c.CUSTOMER_ID = cu.CUSTOMER_ID
GROUP BY d.DEALER_ID, d.DEALER_NAME, d.BRAND;

CREATE OR REPLACE DYNAMIC TABLE BDC_DEMO.ANALYTICS.AGENT_LEADERBOARD
    WAREHOUSE = 'BDC_STD_WH'
    TARGET_LAG = '5 minutes'
    INITIALIZE = 'ON_CREATE'
AS
SELECT
    a.AGENT_ID,
    a.FIRST_NAME || ' ' || a.LAST_NAME                                     AS AGENT_NAME,
    a.DEALER_ID, d.DEALER_NAME, a.SKILL_TIER,
    COUNT(c.CALL_ID)                                                        AS TOTAL_CALLS,
    COUNT(CASE WHEN e.DISPOSITION_CLASS IN ('service_appointment', 'sales_appointment') THEN 1 END)
                                                                            AS APPOINTMENTS_SET,
    AVG(s.OVERALL_SCORE)                                                    AS AVG_SCORE,
    AVG(e.SENTIMENT_SCORE)                                                  AS AVG_SENTIMENT,
    AVG(c.DURATION_SECONDS)                                                 AS AVG_DURATION,
    ROUND(
        0.40 * (COUNT(CASE WHEN e.DISPOSITION_CLASS IN ('service_appointment', 'sales_appointment') THEN 1 END)::FLOAT
                / NULLIF(COUNT(c.CALL_ID), 0)) * 100
        + 0.30 * COALESCE(AVG(s.OVERALL_SCORE), 0)
        + 0.30 * (COALESCE(AVG(e.SENTIMENT_SCORE), 0) + 1) / 2 * 100
    , 2)                                                                    AS COMPOSITE_SCORE,
    RANK() OVER (ORDER BY
        ROUND(
            0.40 * (COUNT(CASE WHEN e.DISPOSITION_CLASS IN ('service_appointment', 'sales_appointment') THEN 1 END)::FLOAT
                    / NULLIF(COUNT(c.CALL_ID), 0)) * 100
            + 0.30 * COALESCE(AVG(s.OVERALL_SCORE), 0)
            + 0.30 * (COALESCE(AVG(e.SENTIMENT_SCORE), 0) + 1) / 2 * 100
        , 2) DESC
    )                                                                       AS RANK
FROM BDC_DEMO.RAW.AGENTS a
JOIN BDC_DEMO.RAW.DEALERS d ON a.DEALER_ID = d.DEALER_ID
JOIN BDC_DEMO.RAW.CALLS c ON a.AGENT_ID = c.AGENT_ID
LEFT JOIN BDC_DEMO.RAW.CALL_SCORES s ON c.CALL_ID = s.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_AI_ENRICHMENTS e ON c.CALL_ID = e.CALL_ID
WHERE a.IS_ACTIVE = TRUE
GROUP BY a.AGENT_ID, a.FIRST_NAME, a.LAST_NAME, a.DEALER_ID, d.DEALER_NAME, a.SKILL_TIER;

CREATE OR REPLACE DYNAMIC TABLE BDC_DEMO.ANALYTICS.CALL_DETAILS
    WAREHOUSE = 'BDC_STD_WH'
    TARGET_LAG = '5 minutes'
    INITIALIZE = 'ON_CREATE'
AS
SELECT
    c.CALL_ID, c.CALL_DATE, c.CALL_DATETIME, c.DURATION_SECONDS,
    c.DISPOSITION, c.DIRECTION, c.CALL_TYPE,
    c.AGENT_ID, a.FIRST_NAME || ' ' || a.LAST_NAME AS AGENT_NAME, a.SKILL_TIER,
    c.CUSTOMER_ID, cu.FIRST_NAME || ' ' || cu.LAST_NAME AS CUSTOMER_NAME,
    c.DEALER_ID, d.DEALER_NAME, c.CAMPAIGN_ID,
    e.SENTIMENT_SCORE, e.SENTIMENT_LABEL, e.CALL_SUMMARY,
    e.DISPOSITION_CLASS, e.FOLLOW_UP_ACTION, e.CUSTOMER_OBJECTIONS,
    s.GREETING, s.ACTIVE_LISTENING, s.OBJECTION_HANDLING,
    s.PRODUCT_KNOWLEDGE, s.CLOSING, s.PROFESSIONALISM, s.OVERALL_SCORE,
    t.TRANSCRIPT_TEXT, t.TRANSCRIPT_JSON, t.WORD_COUNT
FROM BDC_DEMO.RAW.CALLS c
JOIN BDC_DEMO.RAW.AGENTS a ON c.AGENT_ID = a.AGENT_ID
JOIN BDC_DEMO.RAW.CUSTOMERS cu ON c.CUSTOMER_ID = cu.CUSTOMER_ID
JOIN BDC_DEMO.RAW.DEALERS d ON c.DEALER_ID = d.DEALER_ID
LEFT JOIN BDC_DEMO.RAW.CALL_AI_ENRICHMENTS e ON c.CALL_ID = e.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_SCORES s ON c.CALL_ID = s.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_TRANSCRIPTS t ON c.CALL_ID = t.CALL_ID;

-- =============================================================================
-- 6. INTERACTIVE TABLES (COACHING schema, served by Interactive Warehouse)
-- =============================================================================

CREATE INTERACTIVE TABLE IF NOT EXISTS BDC_DEMO.COACHING.DASHBOARD_METRICS
    CLUSTER BY (DEALER_ID)
    TARGET_LAG = '5 minutes'
    WAREHOUSE = BDC_STD_WH
AS SELECT * FROM BDC_DEMO.ANALYTICS.DASHBOARD_METRICS;

CREATE INTERACTIVE TABLE IF NOT EXISTS BDC_DEMO.COACHING.AGENT_LEADERBOARD
    CLUSTER BY (DEALER_ID)
    TARGET_LAG = '5 minutes'
    WAREHOUSE = BDC_STD_WH
AS SELECT * FROM BDC_DEMO.ANALYTICS.AGENT_LEADERBOARD;

CREATE INTERACTIVE TABLE IF NOT EXISTS BDC_DEMO.COACHING.CALL_DETAILS
    CLUSTER BY (DEALER_ID, CALL_DATE)
    TARGET_LAG = '5 minutes'
    WAREHOUSE = BDC_STD_WH
AS SELECT * FROM BDC_DEMO.ANALYTICS.CALL_DETAILS;

-- =============================================================================
-- 7. INTERACTIVE WAREHOUSE
-- =============================================================================

-- NOTE: TABLES clause at creation time causes internal error 300002:3235520510.
-- Workaround: create warehouse first, then ADD TABLES individually.
CREATE INTERACTIVE WAREHOUSE IF NOT EXISTS BDC_INTERACTIVE_WH
    WAREHOUSE_SIZE = 'XSMALL'
    COMMENT = 'Interactive warehouse for sub-second app queries';

ALTER WAREHOUSE BDC_INTERACTIVE_WH ADD TABLES (BDC_DEMO.COACHING.DASHBOARD_METRICS);
ALTER WAREHOUSE BDC_INTERACTIVE_WH ADD TABLES (BDC_DEMO.COACHING.AGENT_LEADERBOARD);
ALTER WAREHOUSE BDC_INTERACTIVE_WH ADD TABLES (BDC_DEMO.COACHING.CALL_DETAILS);

ALTER WAREHOUSE BDC_INTERACTIVE_WH RESUME;

-- =============================================================================
-- 8. CORTEX SEARCH SERVICE
-- =============================================================================

CREATE OR REPLACE CORTEX SEARCH SERVICE BDC_DEMO.COACHING.CALL_TRANSCRIPT_SEARCH
  ON TRANSCRIPT_TEXT
  ATTRIBUTES AGENT_ID, AGENT_NAME, DEALER_NAME, DISPOSITION, SENTIMENT_LABEL, CALL_TYPE
  WAREHOUSE = BDC_STD_WH
  TARGET_LAG = '1 hour'
  COMMENT = 'RAG index over BDC call transcripts for AI coaching'
  AS (
    SELECT c.CALL_ID, c.AGENT_ID,
           a.FIRST_NAME || ' ' || a.LAST_NAME AS AGENT_NAME,
           c.DEALER_ID, d.DEALER_NAME, c.CALL_DATE,
           c.DISPOSITION, e.SENTIMENT_LABEL, c.CALL_TYPE,
           s.OVERALL_SCORE, e.CALL_SUMMARY, t.TRANSCRIPT_TEXT
    FROM BDC_DEMO.RAW.CALLS c
    JOIN BDC_DEMO.RAW.AGENTS a ON c.AGENT_ID = a.AGENT_ID
    JOIN BDC_DEMO.RAW.DEALERS d ON c.DEALER_ID = d.DEALER_ID
    LEFT JOIN BDC_DEMO.RAW.CALL_AI_ENRICHMENTS e ON c.CALL_ID = e.CALL_ID
    LEFT JOIN BDC_DEMO.RAW.CALL_SCORES s ON c.CALL_ID = s.CALL_ID
    LEFT JOIN BDC_DEMO.RAW.CALL_TRANSCRIPTS t ON c.CALL_ID = t.CALL_ID
    WHERE t.TRANSCRIPT_TEXT IS NOT NULL
  );

-- =============================================================================
-- 9. CORTEX AGENT
-- =============================================================================

CREATE OR REPLACE AGENT BDC_DEMO.COACHING.COACHING_AGENT
  COMMENT = 'AI coaching assistant — analyzes BDC call performance via RAG'
FROM SPECIFICATION $$
models:
  orchestration: claude-4-sonnet
orchestration:
  budget:
    seconds: 60
    tokens: 16000
instructions:
  system: |
    You are an AI coaching assistant for a BDC software company
    serving automotive dealerships. Analyze agent call transcripts and
    performance data to provide actionable coaching recommendations.

    When answering questions about a specific agent:
    1. Search their call transcripts to find concrete examples
    2. Reference specific calls and scores when making recommendations
    3. Compare against team averages when relevant
    4. Provide specific, actionable coaching tips (not generic advice)

    Format responses with clear sections using markdown headers.
tools:
  - tool_spec:
      type: cortex_search
      name: CallTranscripts
      description: "Search BDC agent call transcripts, summaries, and scores."
tool_resources:
  CallTranscripts:
    name: "BDC_DEMO.COACHING.CALL_TRANSCRIPT_SEARCH"
    max_results: "10"
$$;
