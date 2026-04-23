-- =============================================================================
-- BDC Agent Coaching Demo — Pre-Deploy (runs BEFORE snow dcm plan)
-- =============================================================================
-- Objects that DCM cannot manage but are required before plan runs:
--   1. Parent database (DCM project lives here, cannot DEFINE its own parent)
--   2. Snowflake-managed Iceberg tables (DCM cannot DEFINE Iceberg tables)
--      These must exist before DCM deploy because analytics.sql DTs reference them.
--   3. Seed data into Iceberg tables from RAW tables (loaded from parquet stage)
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- 1. Parent database + PUBLIC schema for DCM project
CREATE DATABASE IF NOT EXISTS BDC_DEMO
    COMMENT = 'BDC Agent Coaching Demo';

-- Ensure RAW schema exists (DCM defines it, but Iceberg tables need it first)
CREATE SCHEMA IF NOT EXISTS BDC_DEMO.RAW;

-- =============================================================================
-- 2. Snowflake-Managed Iceberg Tables
-- =============================================================================
-- CATALOG = 'SNOWFLAKE' with no EXTERNAL_VOLUME stores data in Snowflake's
-- own managed storage. Supports direct INSERT/MERGE/COPY INTO.
-- No S3, no pg_lake, no external volume needed.
-- =============================================================================

CREATE ICEBERG TABLE IF NOT EXISTS BDC_DEMO.RAW.CALLS_ICEBERG (
    CALL_ID                 VARCHAR,
    DEALER_ID               VARCHAR,
    AGENT_ID                VARCHAR,
    CUSTOMER_ID             VARCHAR,
    CAMPAIGN_ID             VARCHAR,
    CALL_DATETIME           TIMESTAMP_NTZ,
    CALL_DATE               DATE,
    DURATION_SECONDS        NUMBER(3,0),
    DISPOSITION             VARCHAR,
    DIRECTION               VARCHAR,
    CALL_TYPE               VARCHAR,
    RECORDING_URL           VARCHAR,
    CREATED_AT              TIMESTAMP_NTZ
)
    CATALOG         = 'SNOWFLAKE'
    COMMENT         = 'Snowflake-managed Iceberg — calls';

CREATE ICEBERG TABLE IF NOT EXISTS BDC_DEMO.RAW.CALL_TRANSCRIPTS_ICEBERG (
    TRANSCRIPT_ID           VARCHAR,
    CALL_ID                 VARCHAR,
    TRANSCRIPT_JSON         VARCHAR,
    TRANSCRIPT_TEXT         VARCHAR,
    WORD_COUNT              NUMBER(3,0),
    SCENARIO_TEMPLATE       VARCHAR,
    CREATED_AT              TIMESTAMP_NTZ
)
    CATALOG         = 'SNOWFLAKE'
    COMMENT         = 'Snowflake-managed Iceberg — call transcripts';

CREATE ICEBERG TABLE IF NOT EXISTS BDC_DEMO.RAW.CALL_SCORES_ICEBERG (
    SCORE_ID                VARCHAR,
    CALL_ID                 VARCHAR,
    AGENT_ID                VARCHAR,
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
)
    CATALOG         = 'SNOWFLAKE'
    COMMENT         = 'Snowflake-managed Iceberg — call quality scores';

CREATE ICEBERG TABLE IF NOT EXISTS BDC_DEMO.RAW.CALL_AI_ENRICHMENTS_ICEBERG (
    ENRICHMENT_ID               VARCHAR,
    CALL_ID                     VARCHAR,
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
)
    CATALOG         = 'SNOWFLAKE'
    COMMENT         = 'Snowflake-managed Iceberg — LLM-generated call enrichments';

CREATE ICEBERG TABLE IF NOT EXISTS BDC_DEMO.RAW.APPOINTMENTS_ICEBERG (
    APPOINTMENT_ID          VARCHAR,
    CALL_ID                 VARCHAR,
    DEALER_ID               VARCHAR,
    AGENT_ID                VARCHAR,
    CUSTOMER_ID             VARCHAR,
    APPOINTMENT_DATETIME    TIMESTAMP_NTZ,
    APPOINTMENT_DATE        DATE,
    APPOINTMENT_TYPE        VARCHAR,
    STATUS                  VARCHAR,
    DURATION_MINUTES        NUMBER(3,0),
    NOTES                   VARCHAR,
    CREATED_AT              TIMESTAMP_NTZ
)
    CATALOG         = 'SNOWFLAKE'
    COMMENT         = 'Snowflake-managed Iceberg — service/sales appointments';

CREATE ICEBERG TABLE IF NOT EXISTS BDC_DEMO.RAW.AGENT_DAILY_METRICS_ICEBERG (
    METRIC_ID                   VARCHAR,
    AGENT_ID                    VARCHAR,
    DEALER_ID                   VARCHAR,
    METRIC_DATE                 DATE,
    TOTAL_CALLS                 NUMBER(2,0),
    CONNECTED_CALLS             NUMBER(2,0),
    APPOINTMENTS_SET            NUMBER(2,0),
    VOICEMAILS_LEFT             NUMBER(2,0),
    AVG_HANDLE_TIME_SECONDS     NUMBER(3,0),
    TOTAL_TALK_TIME_SECONDS     NUMBER(5,0),
    CONVERSION_RATE             NUMBER(4,3),
    AVG_CALL_SCORE              NUMBER(3,0),
    CREATED_AT                  DATE
)
    CATALOG         = 'SNOWFLAKE'
    COMMENT         = 'Snowflake-managed Iceberg — pre-aggregated agent performance';

-- =============================================================================
-- 3. Seed Iceberg Tables from RAW (after parquet loading)
-- =============================================================================
-- Seeding is handled by deploy-spcs.sh AFTER data loading, not here.
-- On first deploy, RAW tables may not exist yet when pre_deploy.sql runs.
-- On redeploy (data already loaded), deploy-spcs.sh re-seeds explicitly.
-- =============================================================================
