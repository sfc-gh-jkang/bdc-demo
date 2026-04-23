-- =============================================================================
-- Cortex AI Objects — Cortex Search Service + Cortex Agent
-- =============================================================================
-- These objects are NOT managed by DCM (not supported entity types).
-- Run this AFTER dcm deploy + data load.
--
-- Prerequisites:
--   - BDC_DEMO.COACHING schema exists (created by DCM)
--   - RAW tables populated with data
--   - BDC_STD_WH warehouse exists (created by DCM)
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- =============================================================================
-- 1. CORTEX SEARCH SERVICE (RAG over call transcripts)
-- =============================================================================
-- Indexes 15K call transcripts with agent/dealer/disposition metadata
-- for retrieval-augmented generation by the Coaching Agent.

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
-- 2. CORTEX AGENT (coaching assistant)
-- =============================================================================
-- Uses claude-4-sonnet for orchestration with a cortex_search tool.
-- NOTE: Cortex Agents only support Claude models (not llama/mistral).

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
      description: "Search BDC agent call transcripts, summaries, and scores. Returns transcript text, sentiment, disposition, and quality scores."
tool_resources:
  CallTranscripts:
    name: "BDC_DEMO.COACHING.CALL_TRANSCRIPT_SEARCH"
    max_results: "10"
$$;
