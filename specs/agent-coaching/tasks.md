# Tasks: Agent Coaching Dashboard

**Input**: Design documents from `specs/agent-coaching/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US4) or INFRA for shared infrastructure

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [INFRA] Create project scaffolding: data/, sql/, backend/, frontend/, router/, deploy/, observe/ directories
- [ ] T002 [P] [INFRA] Create data/pyproject.toml with numpy, pandas, pyarrow dependencies
- [ ] T003 [P] [INFRA] Create backend/pyproject.toml with fastapi, uvicorn, snowflake-connector-python, pydantic, httpx, cryptography
- [ ] T004 [P] [INFRA] Create frontend/package.json with react 19, tailwindcss 4, recharts, radix-ui, react-query, react-router-dom, shadcn
- [ ] T005 [P] [INFRA] Initialize git repo with .gitignore (node_modules, output/, __pycache__, .env, *.pyc)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until data generation is complete.

- [ ] T006 [INFRA] Create data/generator.py — synthetic data generator for all 16 entities (dealers, agents, customers, vehicles, service_history, campaigns, calls, call_transcripts, call_scores, appointments, tasks, text_messages, email_logs, agent_daily_metrics, call_ai_enrichments, pipeline_status)
- [ ] T007 [INFRA] Create sql/01-postgres.sql — Postgres instance DDL + table creation + \copy seed commands
- [ ] T008 [INFRA] Create sql/02-pg-lake.sql — Storage integration (POSTGRES_EXTERNAL_STORAGE), IAM notes, pg_lake enable, Iceberg table creation, pg_cron flush schedules
- [ ] T009 [INFRA] Create sql/03-iceberg.sql — Snowflake external volume + Iceberg tables with CATALOG_SOURCE=OBJECT_STORE + auto-refresh
- [ ] T010 [INFRA] Create sql/04-dynamic-tables.sql — Dynamic tables with Cortex AI (AI_SENTIMENT, AI_SUMMARIZE, AI_CLASSIFY, AI_EXTRACT) + agent_daily_metrics aggregation
- [ ] T011 [INFRA] Create sql/05-interactive.sql — 3 Interactive Tables (DASHBOARD_METRICS, AGENT_LEADERBOARD, CALL_DETAILS) + Interactive Warehouse BDC_INTERACTIVE_WH
- [ ] T012 [INFRA] Create backend/app/db.py — Connection pool with 3 auth modes (SPCS OAuth token, key-pair, local config.toml), queue-based pool, fetch_all/fetch_one with DictCursor, targeting BDC_INTERACTIVE_WH
- [ ] T013 [INFRA] Create backend/app/main.py — FastAPI app with asynccontextmanager lifespan, CORS middleware, rate limiting
- [ ] T014 [INFRA] Create router/nginx.conf.template — Reverse proxy: /api/* → backend:8081, /* → frontend:5173, /health → backend:8081/health
- [ ] T015 [INFRA] Create router/Dockerfile — nginx with envsubst template processing

**Checkpoint**: Foundation ready — user story endpoints can now be implemented

---

## Phase 3: User Story 1 — Dashboard Overview (Priority: P1) 🎯 MVP

**Goal**: Manager sees KPI cards with sub-second response

### Implementation

- [ ] T016 [US1] Create backend/app/routes/dashboard.py — GET /api/dashboard with dealer_id filter, queries DASHBOARD_METRICS
- [ ] T017 [US1] Create frontend/src/pages/Dashboard.tsx — KPI cards (total calls, avg sentiment, connection rate, show rate) + 30-day trend chart
- [ ] T018 [US1] Create frontend/src/components/KPICard.tsx — Reusable card component with value, label, trend indicator
- [ ] T019 [P] [US1] Create frontend/src/components/TrendChart.tsx — Recharts line chart for 30-day trends
- [ ] T020 [US1] Create frontend/src/api/dashboard.ts — React Query hook for /api/dashboard

**Checkpoint**: Dashboard page functional with real data from Interactive Tables

---

## Phase 4: User Story 2 — Agent Leaderboard (Priority: P2)

**Goal**: Ranked agents with AI-derived composite scores

### Implementation

- [ ] T021 [US2] Create backend/app/routes/leaderboard.py — GET /api/leaderboard with dealer_id filter and sort_by, queries AGENT_LEADERBOARD
- [ ] T022 [US2] Create backend/app/routes/agents.py — GET /api/agents and GET /api/agents/{id}
- [ ] T023 [US2] Create frontend/src/pages/Leaderboard.tsx — Sortable agent table with score bars, click-to-drill
- [ ] T024 [P] [US2] Create frontend/src/components/ScoreBar.tsx — Horizontal bar showing composite score breakdown
- [ ] T025 [US2] Create frontend/src/api/leaderboard.ts — React Query hooks for leaderboard + agent detail

**Checkpoint**: Leaderboard page shows ranked agents, drill-into works

---

## Phase 5: User Story 3 — Call Transcript Viewer (Priority: P3)

**Goal**: Browse calls with AI-annotated transcripts

### Implementation

- [ ] T026 [US3] Create backend/app/routes/calls.py — GET /api/calls (list with filters) and GET /api/calls/{id} (detail with transcript + AI)
- [ ] T027 [US3] Create frontend/src/pages/Calls.tsx — Filterable call list with pagination
- [ ] T028 [US3] Create frontend/src/components/TranscriptView.tsx — Multi-turn transcript display with speaker labels, timestamps, AI annotation sidebar
- [ ] T029 [P] [US3] Create frontend/src/components/SentimentBadge.tsx — Color-coded sentiment indicator (green/yellow/red)
- [ ] T030 [US3] Create frontend/src/api/calls.ts — React Query hooks for call list + call detail

**Checkpoint**: Call viewer shows transcripts with AI annotations

---

## Phase 6: User Story 4 — Pipeline Visualization (Priority: P4)

**Goal**: Visual pipeline flow with live status

### Implementation

- [ ] T031 [US4] Create backend/app/routes/pipeline.py — GET /api/pipeline-status, queries pipeline_status table
- [ ] T032 [US4] Create frontend/src/pages/Pipeline.tsx — Flow diagram (5 stages: PG → Iceberg → DT → IT → App)
- [ ] T033 [US4] Create frontend/src/components/PipelineFlow.tsx — Visual stage boxes with status dots, arrows, timestamps
- [ ] T034 [US4] Create frontend/src/api/pipeline.ts — React Query hook for pipeline status

**Checkpoint**: Pipeline page shows architecture as interactive visualization

---

## Phase 7: Integration & Deployment

- [ ] T035 [INFRA] Create frontend/src/App.tsx — React Router with 4 routes + nav bar + dealer selector
- [ ] T036 [INFRA] Create frontend/src/main.tsx — Entry point with QueryClientProvider
- [ ] T037 [P] [INFRA] Create frontend/src/components/Layout.tsx — App shell with sidebar nav, header, dealer dropdown
- [ ] T038 [INFRA] Create frontend/vite.config.ts with proxy config for dev mode
- [ ] T039 [INFRA] Create frontend/Dockerfile — multi-stage build (node:build → nginx:serve)
- [ ] T040 [INFRA] Create backend/Dockerfile — python:3.11-slim with uvicorn
- [ ] T041 [INFRA] Create deploy/spcs/setup.sql — Database, schema, image repo, compute pool, EAI, network rule
- [ ] T042 [INFRA] Create deploy/spcs/deploy-spcs.sh — Build images, push to Snowflake registry, create/update service
- [ ] T043 [INFRA] Create deploy/spcs/service-spec.yaml — 3 containers (frontend, backend, router) + observe-agent sidecar
- [ ] T044 [INFRA] Create deploy.sh + deploy.env.example — Entry point routing to deploy-spcs.sh
- [ ] T045 [INFRA] Create teardown.sh — Clean removal of all Snowflake resources

**Checkpoint**: Application deployable to SPCS via `./deploy.sh`

---

## Phase 8: Observe Dashboards

- [ ] T046 [P] [INFRA] Create observe/main.tf + variables.tf + outputs.tf — Terraform provider config
- [ ] T047 [P] [INFRA] Create observe/data.tf — Workspace + O4S dataset references (SPCS_HISTORY, QUERY_HISTORY)
- [ ] T048 [INFRA] Create observe/dashboards.tf — 3 dashboard resources (BDC SPCS Service, BDC Query Performance, BDC App Metrics)
- [ ] T049 [P] [INFRA] Create observe/bdc_spcs_stages.json.tftpl + bdc_spcs_layout.json.tftpl
- [ ] T050 [P] [INFRA] Create observe/bdc_query_stages.json.tftpl + bdc_query_layout.json.tftpl
- [ ] T051 [P] [INFRA] Create observe/bdc_app_stages.json.tftpl + bdc_app_layout.json.tftpl

**Checkpoint**: `terraform apply` deploys 3 Observe dashboards

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1
- **Phases 3-6 (User Stories)**: All depend on Phase 2 (T012, T013 specifically)
- **Phase 7 (Integration)**: Depends on Phases 3-6
- **Phase 8 (Observe)**: Can run in parallel with Phases 3-7

### Parallel Opportunities
- T002, T003, T004, T005 can all run in parallel
- T007-T011 (SQL scripts) can all run in parallel
- User Stories (Phases 3-6) can run in parallel once Phase 2 completes
- All Observe tasks (T046-T051) can run in parallel with user story work

### Implementation Strategy: MVP First
1. Phase 1 + Phase 2 → Foundation
2. Phase 3 (US1: Dashboard) → **STOP and VALIDATE** → Demo-ready MVP
3. Phase 4 (US2: Leaderboard) → Incremental
4. Phase 5 (US3: Call Viewer) → Incremental
5. Phase 6 (US4: Pipeline) → Incremental
6. Phase 7 (Integration + Deploy) → Ship
7. Phase 8 (Observe) → Monitoring

---

## Notes

- [P] tasks = different files, no dependencies
- Each user story is independently testable
- Pre-computed AI enrichments avoid live Cortex calls during demo
- Interactive Warehouse has 5-second query timeout — all queries must be simple and selective
- Commit after each phase checkpoint
