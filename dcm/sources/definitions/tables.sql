-- =============================================================================
-- Tables: Snowflake-side tables that receive data from Iceberg / direct load
-- =============================================================================
-- These are standard Snowflake tables in the RAW schema.
-- Data flows: pg_lake Iceberg → Snowflake Iceberg Tables → these tables
-- (via Dynamic Tables) or loaded directly from CSV for demo seeding.
--
-- CHANGE_TRACKING = TRUE enables incremental refresh for downstream
-- Dynamic Tables.
-- =============================================================================

-- Reference tables (small, static)

DEFINE TABLE BDC_DEMO.RAW.DEALERS (
    DEALER_ID       VARCHAR NOT NULL,
    DEALER_NAME     VARCHAR NOT NULL,
    BRAND           VARCHAR NOT NULL,
    CITY            VARCHAR NOT NULL,
    STATE           VARCHAR NOT NULL,
    ZIP_CODE        NUMBER(5,0),
    PHONE           VARCHAR,
    CREATED_AT      DATE
)
CHANGE_TRACKING = TRUE
COMMENT = 'Auto dealerships — 5 rows';

DEFINE TABLE BDC_DEMO.RAW.CAMPAIGNS (
    CAMPAIGN_ID     VARCHAR NOT NULL,
    DEALER_ID       VARCHAR NOT NULL,
    CAMPAIGN_NAME   VARCHAR NOT NULL,
    CAMPAIGN_TYPE   VARCHAR NOT NULL,
    START_DATE      DATE NOT NULL,
    END_DATE        DATE,
    TARGET_COUNT    NUMBER NOT NULL DEFAULT 0,
    IS_ACTIVE       BOOLEAN NOT NULL DEFAULT TRUE,
    CREATED_AT      DATE
)
CHANGE_TRACKING = TRUE
COMMENT = 'Outbound/inbound call campaigns — 25 rows';

-- Operational tables (synced from Postgres via pg_lake → Iceberg)

DEFINE TABLE BDC_DEMO.RAW.AGENTS (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'BDC agents — 30 rows (6 per dealer)';

DEFINE TABLE BDC_DEMO.RAW.CUSTOMERS (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'Vehicle owners and prospects — 2000 rows';

DEFINE TABLE BDC_DEMO.RAW.VEHICLES (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'Customer vehicles — 2500 rows';

DEFINE TABLE BDC_DEMO.RAW.SERVICE_HISTORY (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'Vehicle service records — 10000 rows';

DEFINE TABLE BDC_DEMO.RAW.CALLS (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'Phone calls between agents and customers — 15000 rows';

DEFINE TABLE BDC_DEMO.RAW.CALL_TRANSCRIPTS (
    TRANSCRIPT_ID           VARCHAR NOT NULL,
    CALL_ID                 VARCHAR NOT NULL,
    TRANSCRIPT_JSON         VARCHAR NOT NULL,
    TRANSCRIPT_TEXT         VARCHAR NOT NULL,
    WORD_COUNT              NUMBER(3,0) NOT NULL DEFAULT 0,
    SCENARIO_TEMPLATE       VARCHAR,
    CREATED_AT              TIMESTAMP_NTZ
)
CHANGE_TRACKING = TRUE
COMMENT = 'Multi-turn call transcripts — 15000 rows';

DEFINE TABLE BDC_DEMO.RAW.CALL_SCORES (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'AI-derived call quality scores — 15000 rows';

DEFINE TABLE BDC_DEMO.RAW.APPOINTMENTS (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'Service/sales appointments — 4500 rows';

DEFINE TABLE BDC_DEMO.RAW.TASKS (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'Agent follow-up tasks — 8000 rows';

DEFINE TABLE BDC_DEMO.RAW.TEXT_MESSAGES (
    MESSAGE_ID              VARCHAR NOT NULL,
    DEALER_ID               VARCHAR NOT NULL,
    CUSTOMER_ID             VARCHAR NOT NULL,
    CALL_ID                 VARCHAR,
    DIRECTION               VARCHAR NOT NULL DEFAULT 'outbound',
    BODY                    VARCHAR NOT NULL,
    STATUS                  VARCHAR NOT NULL DEFAULT 'delivered',
    SENT_AT                 TIMESTAMP_NTZ NOT NULL,
    CREATED_AT              TIMESTAMP_NTZ
)
CHANGE_TRACKING = TRUE
COMMENT = 'SMS messages — 5000 rows';

DEFINE TABLE BDC_DEMO.RAW.EMAIL_LOGS (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'Email campaign logs — 3000 rows';

-- AI enrichment and analytics tables (RAW schema)

DEFINE TABLE BDC_DEMO.RAW.CALL_AI_ENRICHMENTS (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'LLM-generated call enrichments — 15000 rows';

DEFINE TABLE BDC_DEMO.RAW.AGENT_DAILY_METRICS (
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
)
CHANGE_TRACKING = TRUE
COMMENT = 'Pre-aggregated agent performance metrics by day — 1 row per agent per day';

-- System table

DEFINE TABLE BDC_DEMO.RAW.PIPELINE_STATUS (
    PIPELINE_ID         VARCHAR NOT NULL,
    PIPELINE_NAME       VARCHAR NOT NULL,
    STATUS              VARCHAR NOT NULL,
    DESCRIPTION         VARCHAR,
    LAST_RUN_AT         TIMESTAMP_NTZ,
    NEXT_RUN_AT         TIMESTAMP_NTZ,
    RECORDS_PROCESSED   NUMBER,
    ERROR_MESSAGE       VARCHAR,
    CREATED_AT          TIMESTAMP_NTZ
)
COMMENT = 'Pipeline stage health — 6 rows';
