-- =============================================================================
-- BDC Agent Coaching Demo — Cortex Analyst Semantic View
-- =============================================================================
-- Creates a semantic view over COACHING interactive tables to enable
-- natural-language analytics queries like "which agent had the most
-- appointments last week?"
--
-- Usage:
--   snow sql -c aws_spcs -f sql/05-cortex-analyst.sql
-- =============================================================================

USE DATABASE BDC_DEMO;
USE SCHEMA COACHING;
USE WAREHOUSE BDC_STD_WH;

CREATE OR REPLACE SEMANTIC VIEW BDC_DEMO.COACHING.BDC_ANALYTICS
  TABLES (
    call_details AS BDC_DEMO.COACHING.CALL_DETAILS
      PRIMARY KEY (CALL_ID)
      COMMENT = 'Individual call details with agent scores and AI enrichments'
    ,
    agent_leaderboard AS BDC_DEMO.COACHING.AGENT_LEADERBOARD
      PRIMARY KEY (AGENT_ID)
      COMMENT = 'Agent performance leaderboard with rankings'
    ,
    dashboard_metrics AS BDC_DEMO.COACHING.DASHBOARD_METRICS
      PRIMARY KEY (DEALER_ID)
      COMMENT = 'Dealer-level dashboard metrics'
  )
  RELATIONSHIPS (
    call_details (AGENT_ID) REFERENCES agent_leaderboard,
    call_details (DEALER_ID) REFERENCES dashboard_metrics
  )
  DIMENSIONS (
    call_details.call_date AS CALL_DATE
      COMMENT = 'Date of the call',
    call_details.disposition AS DISPOSITION
      COMMENT = 'Call outcome: appointment_set, voicemail, no_answer, callback_requested, etc.',
    call_details.direction AS DIRECTION
      COMMENT = 'Call direction: inbound or outbound',
    call_details.agent_name AS AGENT_NAME
      COMMENT = 'Full name of the BDC agent',
    call_details.skill_tier AS SKILL_TIER
      COMMENT = 'Agent skill tier: top, mid, or bottom',
    call_details.customer_name AS CUSTOMER_NAME
      COMMENT = 'Full name of the customer',
    call_details.dealer_name AS DEALER_NAME
      COMMENT = 'Name of the car dealership',
    call_details.sentiment_label AS SENTIMENT_LABEL
      COMMENT = 'Sentiment: positive, neutral, negative',
    call_details.call_type AS CALL_TYPE
      COMMENT = 'Type of call',
    agent_leaderboard.lb_agent_name AS AGENT_NAME
      COMMENT = 'Agent name on leaderboard',
    agent_leaderboard.lb_skill_tier AS SKILL_TIER
      COMMENT = 'Agent performance tier',
    agent_leaderboard.lb_dealer_name AS DEALER_NAME
      COMMENT = 'Dealership on leaderboard',
    dashboard_metrics.dm_dealer_name AS DEALER_NAME
      COMMENT = 'Dealer name on dashboard',
    dashboard_metrics.dm_brand AS BRAND
      COMMENT = 'Car brand: Toyota, Honda, Ford, Chevrolet, BMW'
  )
  METRICS (
    call_details.avg_duration AS AVG(DURATION_SECONDS)
      COMMENT = 'Average call duration in seconds',
    call_details.avg_score AS AVG(OVERALL_SCORE)
      COMMENT = 'Average composite coaching score 0-100',
    call_details.avg_sentiment AS AVG(SENTIMENT_SCORE)
      COMMENT = 'Average AI sentiment score 0.0-1.0',
    call_details.total_calls AS COUNT(CALL_ID)
      COMMENT = 'Total number of calls',
    agent_leaderboard.total_agent_calls AS SUM(TOTAL_CALLS)
      COMMENT = 'Sum of calls across agents',
    agent_leaderboard.total_appointments AS SUM(APPOINTMENTS_SET)
      COMMENT = 'Sum of appointments across agents',
    dashboard_metrics.total_dealer_calls AS SUM(TOTAL_CALLS)
      COMMENT = 'Sum of calls across dealers',
    dashboard_metrics.avg_conversion AS AVG(CONVERSION_RATE)
      COMMENT = 'Average dealer conversion rate'
  )
  COMMENT = 'BDC call center analytics for natural-language queries via Cortex Analyst';

-- Verify
DESCRIBE SEMANTIC VIEW BDC_DEMO.COACHING.BDC_ANALYTICS;
