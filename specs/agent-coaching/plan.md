# Implementation Plan: Agent Coaching Dashboard

**Date**: 2026-03-31 | **Spec**: specs/agent-coaching/spec.md

## Summary

Custom demo showcasing an end-to-end Snowflake data pipeline: Snowflake Postgres → pg_lake (Iceberg on S3) → Snowflake Iceberg Tables → Dynamic Tables with Cortex AI enrichment → Interactive Tables → React application on SPCS, monitored by Observe.

## Technical Context

**Language/Version**: Python 3.11 (backend, data generator), TypeScript/JSX (frontend)
**Primary Dependencies**: FastAPI 0.135+, React 19, TailwindCSS 4, Recharts, Radix UI, React Query, React Router
**Storage**: Snowflake Postgres (operational) → S3 via pg_lake (Iceberg/Parquet) → Snowflake (analytics)
**Testing**: Manual verification + curl for API, browser for frontend
**Target Platform**: SPCS (Snowpark Container Services) on AWS us-east-1
**Project Type**: Web application (3-container SPCS service)
**Performance Goals**: < 500ms p95 query latency on Interactive Tables
**Constraints**: 5-second hard query timeout on Interactive Warehouse, no UPDATE/DELETE on Interactive Tables
**Scale/Scope**: 5 dealers, 30 agents, 15K calls, 16 tables total

## Constitution Check

- ✅ BDC-Realistic Data: All synthetic data uses industry benchmarks
- ✅ End-to-End Pipeline: Every stage independently demonstrable
- ✅ Snowflake-Native: No external ETL or AI APIs
- ✅ Demo-Ready: Single deploy script, idempotent

## Project Structure

### Documentation

```text
specs/agent-coaching/
├── spec.md              # Product specification
├── plan.md              # This file
└── tasks.md             # Task breakdown
```

### Source Code

```text
bdc-demo/
├── CONSTITUTION.md
├── specs/agent-coaching/     # SDD artifacts
├── data/
│   ├── generator.py          # Synthetic data generator (16 entities)
│   ├── pyproject.toml        # Dependencies: numpy, pandas, pyarrow
│   └── output/               # Generated parquet + CSV files
├── sql/
│   ├── 01-postgres.sql       # PG instance creation + table DDL + seed commands
│   ├── 02-pg-lake.sql        # Storage integration, IAM, pg_lake, Iceberg tables, pg_cron
│   ├── 03-iceberg.sql        # Snowflake external volume + Iceberg tables
│   ├── 04-dynamic-tables.sql # Cortex AI enrichment dynamic tables
│   ├── 05-interactive.sql    # Interactive tables + Interactive Warehouse
│   └── 06-spcs-setup.sql     # SPCS resources (DB, schema, image repo, compute pool, service)
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml        # fastapi, uvicorn, snowflake-connector-python, pydantic, httpx, cryptography
│   └── app/
│       ├── main.py           # FastAPI app with lifespan, CORS, rate limiting
│       ├── db.py             # Connection pool (SPCS OAuth, key-pair, local config.toml)
│       └── routes/
│           ├── dashboard.py  # GET /api/dashboard
│           ├── agents.py     # GET /api/agents, GET /api/agents/{id}
│           ├── calls.py      # GET /api/calls, GET /api/calls/{id}
│           ├── leaderboard.py # GET /api/leaderboard
│           └── pipeline.py   # GET /api/pipeline-status
├── frontend/
│   ├── Dockerfile
│   ├── package.json          # react 19, tailwindcss 4, recharts, radix-ui, react-query, react-router-dom
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── App.tsx           # Router with 4 routes
│       ├── main.tsx          # Entry point
│       ├── api/              # React Query hooks for each endpoint
│       ├── components/       # Shared UI components (KPICard, DataTable, TranscriptView, PipelineFlow)
│       └── pages/
│           ├── Dashboard.tsx
│           ├── Leaderboard.tsx
│           ├── Calls.tsx
│           └── Pipeline.tsx
├── router/
│   ├── Dockerfile
│   └── nginx.conf.template   # Reverse proxy: /api/* → backend:8081, /* → frontend:5173
├── deploy/
│   ├── spcs/
│   │   ├── deploy-spcs.sh    # Build images, push, create service
│   │   ├── setup.sql         # SPCS resource creation
│   │   └── service-spec.yaml # Reference spec (3 containers + observe-agent sidecar)
│   └── deploy.env.example
├── deploy.sh                  # Entry point: reads deploy.env, routes to deploy-spcs.sh
├── deploy.env.example
├── teardown.sh                # Clean removal of all resources
└── observe/
    ├── main.tf
    ├── variables.tf
    ├── outputs.tf
    ├── data.tf                # Workspace + O4S dataset references
    ├── dashboards.tf          # 3 dashboard resources
    ├── bdc_spcs_stages.json.tftpl + bdc_spcs_layout.json.tftpl
    ├── bdc_query_stages.json.tftpl + bdc_query_layout.json.tftpl
    └── bdc_app_stages.json.tftpl + bdc_app_layout.json.tftpl
```

## Data Model (16 Entities)

### Reference Tables (small, static)
- **dealers** (dealer_id PK, name, brand, city, state, timezone) — 5 rows
- **campaigns** (campaign_id PK, dealer_id FK, name, type, channel, start_date, end_date, target_count, response_count, conversion_count) — 25 rows

### Operational Tables (seeded into Postgres, synced to Iceberg)
- **agents** (agent_id PK, dealer_id FK, first_name, last_name, email, hire_date, skill_tier, is_active) — 30 rows
- **customers** (customer_id PK, first_name, last_name, phone, email, preferred_contact, opt_in_sms, opt_in_email, city, state) — 2,000 rows
- **vehicles** (vehicle_id PK, customer_id FK, year, make, model, vin, mileage, last_service_date) — 2,500 rows
- **service_history** (service_id PK, vehicle_id FK, service_date, service_type, mileage_at_service, advisor_name, total_cost) — 10,000 rows
- **calls** (call_id PK, agent_id FK, customer_id FK, campaign_id FK, call_date, call_time, duration_seconds, direction, disposition, connected_to_advisor, phone_number) — 15,000 rows
- **call_transcripts** (transcript_id PK, call_id FK, transcript_json VARIANT, transcript_text TEXT, word_count INT) — 15,000 rows
- **call_scores** (score_id PK, call_id FK, greeting_score, needs_assessment_score, objection_handling_score, close_score, overall_score) — 15,000 rows
- **appointments** (appointment_id PK, call_id FK, customer_id FK, dealer_id FK, appointment_type, scheduled_date, scheduled_time, status, show_status) — 4,500 rows
- **tasks** (task_id PK, agent_id FK, customer_id FK, call_id FK, task_type, due_date, completed_date, status) — 8,000 rows
- **text_messages** (message_id PK, agent_id FK, customer_id FK, direction, message_text, sent_at, status) — 5,000 rows
- **email_logs** (email_id PK, campaign_id FK, customer_id FK, subject, sent_at, opened_at, clicked_at, status) — 3,000 rows

### Analytics Tables (Dynamic Tables in Snowflake)
- **call_ai_enrichments** (call_id PK, sentiment_score, sentiment_label, call_summary, disposition_class, follow_up_action, customer_objections, appointment_date_extracted) — 15,000 rows
- **agent_daily_metrics** (agent_id, metric_date, dealer_id, calls_made, calls_connected, avg_duration, avg_sentiment, appointments_set, appointments_shown, composite_score) — 900 rows

### System Tables
- **pipeline_status** (stage_name PK, stage_order, source_system, target_system, last_refresh_at, row_count, status, error_message) — 6 rows

## API Contracts

### GET /api/dashboard
**Query params**: dealer_id (optional int), days (optional int, default 30)
**Response**: `{ kpis: { total_calls, avg_sentiment, connection_rate, show_rate }, trends: [{ date, calls, sentiment, connections, shows }] }`
**Source**: BDC_DEMO.COACHING.DASHBOARD_METRICS via BDC_INTERACTIVE_WH

### GET /api/agents
**Query params**: dealer_id (optional int)
**Response**: `{ agents: [{ agent_id, name, dealer_name, skill_tier, calls_today, avg_sentiment }] }`

### GET /api/agents/{agent_id}
**Response**: `{ agent: { ...agent_fields }, metrics: { ...30_day_metrics }, recent_calls: [{ call_id, date, duration, sentiment, disposition }] }`

### GET /api/leaderboard
**Query params**: dealer_id (optional int), sort_by (optional string, default "composite_score")
**Response**: `{ agents: [{ rank, agent_id, name, dealer_name, composite_score, sentiment_avg, conversion_rate, efficiency_score, satisfaction_score }] }`
**Source**: BDC_DEMO.COACHING.AGENT_LEADERBOARD via BDC_INTERACTIVE_WH

### GET /api/calls
**Query params**: agent_id (optional), dealer_id (optional), date_from (optional), date_to (optional), disposition (optional), limit (default 50), offset (default 0)
**Response**: `{ calls: [{ call_id, agent_name, customer_name, date, duration, sentiment, disposition, has_transcript }], total: int }`
**Source**: BDC_DEMO.COACHING.CALL_DETAILS via BDC_INTERACTIVE_WH

### GET /api/calls/{call_id}
**Response**: `{ call: { ...call_fields }, transcript: [{ speaker, text, offset_seconds }], ai: { sentiment, summary, disposition, follow_up, objections } }`

### GET /api/pipeline-status
**Response**: `{ stages: [{ name, order, source, target, last_refresh, row_count, status }] }`

### GET /health
**Response**: `{ status: "ok", warehouse: "BDC_INTERACTIVE_WH", connection: "active" }`

## Complexity Tracking

No constitution violations. Project structure follows the established convenience-store-dashboard pattern.
