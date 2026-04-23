-- =============================================================================
-- Analytics: Dynamic Tables sourced from Postgres→Iceberg + direct RAW tables
-- =============================================================================
-- These dynamic tables auto-refresh from a mix of:
--   - *_ICEBERG tables: fed by Postgres pg_lake → S3 Iceberg → Snowflake
--     (CALLS, CALL_TRANSCRIPTS, CALL_SCORES, CALL_AI_ENRICHMENTS,
--      APPOINTMENTS, AGENT_DAILY_METRICS)
--   - Standard RAW tables: direct-loaded reference data
--     (AGENTS, DEALERS, CUSTOMERS)
-- Cortex AI functions are used in the live demo UI only, not here.
-- TARGET_LAG = 'DOWNSTREAM' means they refresh only when their downstream
-- consumers (Interactive Tables) need fresh data.
-- =============================================================================

-- Call AI Enrichments — denormalized enrichment data joined with call context
DEFINE DYNAMIC TABLE BDC_DEMO.ANALYTICS.CALL_AI_ENRICHMENTS
WAREHOUSE = 'BDC_STD_WH'
TARGET_LAG = 'DOWNSTREAM'
INITIALIZE = 'ON_CREATE'
AS
SELECT
    e.ENRICHMENT_ID,
    e.CALL_ID,
    c.AGENT_ID,
    c.DEALER_ID,
    c.CUSTOMER_ID,
    c.CALL_DATE,
    c.DURATION_SECONDS,
    c.DISPOSITION,
    c.DIRECTION,
    e.SENTIMENT_SCORE,
    e.SENTIMENT_LABEL,
    e.CALL_SUMMARY,
    e.DISPOSITION_CLASS,
    e.FOLLOW_UP_ACTION,
    e.CUSTOMER_OBJECTIONS,
    e.APPOINTMENT_DATE_EXTRACTED,
    t.TRANSCRIPT_TEXT,
    t.WORD_COUNT
FROM BDC_DEMO.RAW.CALL_AI_ENRICHMENTS_ICEBERG e
JOIN BDC_DEMO.RAW.CALLS_ICEBERG c ON e.CALL_ID = c.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_TRANSCRIPTS_ICEBERG t ON e.CALL_ID = t.CALL_ID;

-- Agent Daily Metrics — pre-aggregated per-agent performance joined with agent/dealer info
DEFINE DYNAMIC TABLE BDC_DEMO.ANALYTICS.AGENT_DAILY_METRICS
WAREHOUSE = 'BDC_STD_WH'
TARGET_LAG = 'DOWNSTREAM'
INITIALIZE = 'ON_CREATE'
AS
SELECT
    a.AGENT_ID,
    a.DEALER_ID,
    a.FIRST_NAME || ' ' || a.LAST_NAME AS AGENT_NAME,
    a.SKILL_TIER,
    d.DEALER_NAME,
    m.METRIC_DATE,
    m.TOTAL_CALLS,
    m.CONNECTED_CALLS,
    m.APPOINTMENTS_SET,
    m.VOICEMAILS_LEFT,
    m.AVG_HANDLE_TIME_SECONDS,
    m.TOTAL_TALK_TIME_SECONDS,
    m.CONVERSION_RATE,
    m.AVG_CALL_SCORE
FROM BDC_DEMO.RAW.AGENT_DAILY_METRICS_ICEBERG m
JOIN BDC_DEMO.RAW.AGENTS a ON m.AGENT_ID = a.AGENT_ID
JOIN BDC_DEMO.RAW.DEALERS d ON a.DEALER_ID = d.DEALER_ID;

-- Dashboard Metrics — pre-aggregated KPIs per dealer for the dashboard overview
DEFINE DYNAMIC TABLE BDC_DEMO.ANALYTICS.DASHBOARD_METRICS
WAREHOUSE = 'BDC_STD_WH'
TARGET_LAG = '5 minutes'
INITIALIZE = 'ON_CREATE'
AS
SELECT
    d.DEALER_ID,
    d.DEALER_NAME,
    d.BRAND,
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
JOIN BDC_DEMO.RAW.CALLS_ICEBERG c ON d.DEALER_ID = c.DEALER_ID
LEFT JOIN BDC_DEMO.RAW.CALL_AI_ENRICHMENTS_ICEBERG e ON c.CALL_ID = e.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_SCORES_ICEBERG s ON c.CALL_ID = s.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CUSTOMERS cu ON c.CUSTOMER_ID = cu.CUSTOMER_ID
GROUP BY d.DEALER_ID, d.DEALER_NAME, d.BRAND;

-- Agent Leaderboard — ranked agents with composite performance scores
DEFINE DYNAMIC TABLE BDC_DEMO.ANALYTICS.AGENT_LEADERBOARD
WAREHOUSE = 'BDC_STD_WH'
TARGET_LAG = '5 minutes'
INITIALIZE = 'ON_CREATE'
AS
SELECT
    a.AGENT_ID,
    a.FIRST_NAME || ' ' || a.LAST_NAME                                     AS AGENT_NAME,
    a.DEALER_ID,
    d.DEALER_NAME,
    a.SKILL_TIER,
    COUNT(c.CALL_ID)                                                        AS TOTAL_CALLS,
    COUNT(CASE WHEN e.DISPOSITION_CLASS IN ('service_appointment', 'sales_appointment') THEN 1 END)
                                                                            AS APPOINTMENTS_SET,
    AVG(s.OVERALL_SCORE)                                                    AS AVG_SCORE,
    AVG(e.SENTIMENT_SCORE)                                                  AS AVG_SENTIMENT,
    AVG(c.DURATION_SECONDS)                                                 AS AVG_DURATION,
    -- Composite score: 40% conversion rate + 30% call score + 30% sentiment (normalized 0-100)
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
JOIN BDC_DEMO.RAW.CALLS_ICEBERG c ON a.AGENT_ID = c.AGENT_ID
LEFT JOIN BDC_DEMO.RAW.CALL_SCORES_ICEBERG s ON c.CALL_ID = s.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_AI_ENRICHMENTS_ICEBERG e ON c.CALL_ID = e.CALL_ID
WHERE a.IS_ACTIVE = TRUE
GROUP BY a.AGENT_ID, a.FIRST_NAME, a.LAST_NAME, a.DEALER_ID, d.DEALER_NAME, a.SKILL_TIER;

-- Call Details — denormalized view for the call transcript viewer
DEFINE DYNAMIC TABLE BDC_DEMO.ANALYTICS.CALL_DETAILS
WAREHOUSE = 'BDC_STD_WH'
TARGET_LAG = '5 minutes'
INITIALIZE = 'ON_CREATE'
AS
SELECT
    c.CALL_ID,
    c.CALL_DATE,
    c.CALL_DATETIME,
    c.DURATION_SECONDS,
    c.DISPOSITION,
    c.DIRECTION,
    c.CALL_TYPE,
    c.AGENT_ID,
    a.FIRST_NAME || ' ' || a.LAST_NAME                                     AS AGENT_NAME,
    a.SKILL_TIER,
    c.CUSTOMER_ID,
    cu.FIRST_NAME || ' ' || cu.LAST_NAME                                   AS CUSTOMER_NAME,
    c.DEALER_ID,
    d.DEALER_NAME,
    c.CAMPAIGN_ID,
    e.SENTIMENT_SCORE,
    e.SENTIMENT_LABEL,
    e.CALL_SUMMARY,
    e.DISPOSITION_CLASS,
    e.FOLLOW_UP_ACTION,
    e.CUSTOMER_OBJECTIONS,
    s.GREETING,
    s.ACTIVE_LISTENING,
    s.OBJECTION_HANDLING,
    s.PRODUCT_KNOWLEDGE,
    s.CLOSING,
    s.PROFESSIONALISM,
    s.OVERALL_SCORE,
    t.TRANSCRIPT_TEXT,
    t.TRANSCRIPT_JSON,
    t.WORD_COUNT
FROM BDC_DEMO.RAW.CALLS_ICEBERG c
JOIN BDC_DEMO.RAW.AGENTS a ON c.AGENT_ID = a.AGENT_ID
JOIN BDC_DEMO.RAW.CUSTOMERS cu ON c.CUSTOMER_ID = cu.CUSTOMER_ID
JOIN BDC_DEMO.RAW.DEALERS d ON c.DEALER_ID = d.DEALER_ID
LEFT JOIN BDC_DEMO.RAW.CALL_AI_ENRICHMENTS_ICEBERG e ON c.CALL_ID = e.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_SCORES_ICEBERG s ON c.CALL_ID = s.CALL_ID
LEFT JOIN BDC_DEMO.RAW.CALL_TRANSCRIPTS_ICEBERG t ON c.CALL_ID = t.CALL_ID;
