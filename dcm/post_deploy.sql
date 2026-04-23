-- =============================================================================
-- BDC Agent Coaching Demo — Post-Deploy (runs AFTER snow dcm deploy)
-- =============================================================================
-- Objects that DCM cannot manage but depend on DEFINE'd objects:
--   1. Interactive Tables (not in DCM's supported entity list)
--   2. Interactive Warehouse (not a standard warehouse)
--
-- NOTE: Iceberg tables are created in pre_deploy.sql (before DCM deploy)
-- because analytics.sql DTs reference *_ICEBERG tables.
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- =============================================================================
-- 1. INTERACTIVE TABLES (served by Interactive Warehouse)
-- =============================================================================
-- Interactive Tables are populated from Dynamic Tables in ANALYTICS schema.
-- They provide sub-second query latency for the React app.
-- Cannot UPDATE/DELETE — full refresh only via CREATE OR REPLACE.

CREATE INTERACTIVE TABLE IF NOT EXISTS BDC_DEMO.COACHING.DASHBOARD_METRICS
    CLUSTER BY (DEALER_ID)
    TARGET_LAG = '5 minutes'
    WAREHOUSE = BDC_STD_WH
AS
SELECT * FROM BDC_DEMO.ANALYTICS.DASHBOARD_METRICS;

CREATE INTERACTIVE TABLE IF NOT EXISTS BDC_DEMO.COACHING.AGENT_LEADERBOARD
    CLUSTER BY (DEALER_ID)
    TARGET_LAG = '5 minutes'
    WAREHOUSE = BDC_STD_WH
AS
SELECT * FROM BDC_DEMO.ANALYTICS.AGENT_LEADERBOARD;

CREATE INTERACTIVE TABLE IF NOT EXISTS BDC_DEMO.COACHING.CALL_DETAILS
    CLUSTER BY (DEALER_ID, CALL_DATE)
    TARGET_LAG = '5 minutes'
    WAREHOUSE = BDC_STD_WH
AS
SELECT * FROM BDC_DEMO.ANALYTICS.CALL_DETAILS;

-- =============================================================================
-- 2. INTERACTIVE WAREHOUSE
-- =============================================================================
-- Created SUSPENDED — must be explicitly resumed.
-- Can ONLY query Interactive Tables. No auto-suspend.

-- NOTE: TABLES clause at creation time causes internal error 300002:3235520510.
-- Workaround: create warehouse first, then ADD TABLES individually.
CREATE INTERACTIVE WAREHOUSE IF NOT EXISTS BDC_INTERACTIVE_WH
    WAREHOUSE_SIZE = 'XSMALL'
    COMMENT = 'Interactive warehouse for sub-second app queries';

ALTER WAREHOUSE BDC_INTERACTIVE_WH ADD TABLES (BDC_DEMO.COACHING.DASHBOARD_METRICS);
ALTER WAREHOUSE BDC_INTERACTIVE_WH ADD TABLES (BDC_DEMO.COACHING.AGENT_LEADERBOARD);
ALTER WAREHOUSE BDC_INTERACTIVE_WH ADD TABLES (BDC_DEMO.COACHING.CALL_DETAILS);

ALTER WAREHOUSE BDC_INTERACTIVE_WH RESUME;
