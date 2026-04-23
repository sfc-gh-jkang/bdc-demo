# Feature Specification: Agent Coaching Dashboard

**Created**: 2026-03-31
**Status**: Approved
**Input**: Custom demo for automotive BDC — automotive BDC software company, existing Snowflake Enterprise customer

## User Scenarios & Testing

### User Story 1 — Dashboard Overview (Priority: P1) 🎯 MVP

A BDC manager opens the dashboard and immediately sees today's key performance indicators across their dealership: total calls made, average sentiment score, advisor connection rate, and appointment show rate. They can select a dealer from a dropdown to filter all metrics. Trend charts show the past 30 days.

**Why this priority**: This is the landing page and the first thing shown in any demo. It proves sub-second query latency on Interactive Tables and shows real-time KPI visibility.

**Independent Test**: Load the dashboard page with dealer_id=1, verify 4 KPI cards render with numeric values, verify trend chart shows 30 data points, verify response time < 1 second.

**Acceptance Scenarios**:
1. **Given** the dashboard loads, **When** no dealer is selected, **Then** show aggregate KPIs across all 5 dealers
2. **Given** a dealer is selected from the dropdown, **When** the selection changes, **Then** all KPI cards and charts update within 500ms
3. **Given** the dashboard is open, **When** new data flows through the pipeline, **Then** KPIs reflect the latest data within the TARGET_LAG window (5 minutes)

### User Story 2 — Agent Leaderboard (Priority: P2)

A BDC manager navigates to the leaderboard to see all agents ranked by a composite AI-derived performance score. The score combines: average call sentiment (30%), appointment conversion rate (30%), average call duration efficiency (20%), and customer satisfaction indicators from transcript analysis (20%). Clicking an agent shows their detail page.

**Why this priority**: Agent ranking is the core value proposition. This story demonstrates Cortex AI enrichment feeding actionable rankings.

**Independent Test**: Navigate to /leaderboard, verify 30 agents appear sorted by score, click top agent, verify detail page shows their call history and individual metrics.

**Acceptance Scenarios**:
1. **Given** the leaderboard page loads, **When** a dealer is selected, **Then** show only that dealer's 6 agents ranked by composite score
2. **Given** the leaderboard shows all agents, **When** a column header is clicked, **Then** the table re-sorts by that column
3. **Given** an agent row is clicked, **When** the detail view opens, **Then** show agent's 30-day trend, recent calls, and AI-derived strengths/weaknesses

### User Story 3 — Call Transcript Viewer (Priority: P3)

A BDC manager or quality analyst browses recent calls, filtered by agent, date range, or disposition. They open a specific call to see the full transcript with AI annotations: sentiment score, auto-generated summary, classified disposition (service_appointment, sales_appointment, information_only, complaint, callback_request), and extracted follow-up actions.

**Why this priority**: Call transcripts with AI enrichment are the demo's most visually impressive feature. Showing Cortex AI analysis on transcripts is directly relevant to automotive BDC operations.

**Independent Test**: Navigate to /calls, filter by agent_id=1 and last 7 days, verify call list appears, open first call, verify transcript renders with speaker labels, verify AI summary and sentiment badge are visible.

**Acceptance Scenarios**:
1. **Given** the call list page loads, **When** filters are applied (agent, date, disposition), **Then** results update within 500ms
2. **Given** a call is selected, **When** the detail view opens, **Then** show full transcript with speaker labels, AI summary, sentiment badge, disposition tag, and extracted follow-up actions
3. **Given** a call transcript is displayed, **When** the user scrolls through turns, **Then** each turn shows speaker name, text, and timestamp offset

### User Story 4 — Pipeline Visualization (Priority: P4)

A technical viewer (SE demo audience) sees a visual representation of the entire data pipeline: Postgres → pg_lake (Iceberg) → Snowflake Iceberg → Dynamic Tables (Cortex AI) → Interactive Tables. Each stage shows its current status (active/stale), last refresh timestamp, and row count. This is the "how it works" page.

**Why this priority**: This page tells the technical story — it's the architecture slide made interactive. Lower priority because it's not user-facing functionality.

**Independent Test**: Navigate to /pipeline, verify 5 pipeline stages render as a flow diagram, verify each stage shows a status indicator and timestamp.

**Acceptance Scenarios**:
1. **Given** the pipeline page loads, **When** all stages are healthy, **Then** show green status dots and recent timestamps for each stage
2. **Given** a pipeline stage is clicked, **When** the detail expands, **Then** show the SQL definition, row count, and refresh history

### Edge Cases

- What happens when Interactive Warehouse is suspended? → API returns 503 with "Service temporarily unavailable" message
- What happens when a call has no transcript? → Call detail page shows "Transcript not available" placeholder, AI enrichment fields show "N/A"
- What happens when dealer_id doesn't exist? → API returns empty results, dashboard shows "No data for selected dealer"
- What happens when Dynamic Table refresh is stalled? → Pipeline page shows amber status dot and "Stale" label with last successful refresh time

## Requirements

### Functional Requirements

- **FR-001**: System MUST serve dashboard KPIs with sub-second latency (< 500ms p95) via Interactive Tables
- **FR-002**: System MUST display call transcripts as multi-turn conversations with speaker labels
- **FR-003**: System MUST show AI-derived sentiment, summary, disposition, and extracted entities for each call
- **FR-004**: System MUST allow filtering by dealer, agent, date range, and call disposition
- **FR-005**: System MUST rank agents by composite AI-derived performance score
- **FR-006**: System MUST visualize the data pipeline stages with live status indicators
- **FR-007**: System MUST be deployable to SPCS via a single deploy script
- **FR-008**: System MUST work with pre-computed AI enrichments (no live Cortex calls required during demo)

### Non-Functional Requirements

- **NFR-001**: All API queries MUST use Interactive Warehouse (BDC_INTERACTIVE_WH) for sub-second response
- **NFR-002**: Frontend MUST be responsive (mobile + desktop)
- **NFR-003**: Setup MUST be idempotent — running twice must not fail
- **NFR-004**: All synthetic data MUST be BDC-realistic per CONSTITUTION.md principles

### Key Entities

- **Dealer**: Auto dealership with brand, location. Has many agents.
- **Agent**: BDC representative. Has performance metrics, belongs to one dealer.
- **Customer**: Vehicle owner or prospect. Has contact preferences, vehicles.
- **Vehicle**: Year/make/model with mileage, service history. Belongs to customer.
- **Service History**: Maintenance records tied to vehicles. Drives service reminder calls.
- **Campaign**: Outbound or inbound call campaign (service recall, lease maturity, CSI survey).
- **Call**: Phone interaction between agent and customer. Has duration, disposition, campaign association.
- **Call Transcript**: Multi-turn dialogue JSON for a call. Speaker, text, timestamp offset per turn.
- **Call Score**: AI-derived quality scores (greeting, needs assessment, objection handling, close).
- **Appointment**: Scheduled service or sales appointment. Has show/no-show status.
- **Task**: Follow-up action (call back, send email, send text). Has completion status.
- **Text Message**: SMS sent to customer (appointment confirmation, service reminder).
- **Email Log**: Email campaign interaction (sent, opened, clicked).
- **Agent Daily Metrics**: Pre-aggregated daily performance per agent.
- **Call AI Enrichment**: Cortex AI outputs (sentiment, summary, disposition, extracted entities).
- **Pipeline Status**: Current state of each pipeline stage (last refresh, row count, health).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Dashboard KPI queries return in < 500ms (p95) on Interactive Warehouse
- **SC-002**: Demo audience can follow the data flow from Postgres INSERT to React dashboard within a single demo session
- **SC-003**: Call transcript viewer displays AI annotations that are contextually relevant to automotive BDC conversations
- **SC-004**: Agent leaderboard correctly ranks agents where top-tier agents (top 20% by synthetic design) appear at the top

## Assumptions

- Snowflake Postgres, Interactive Tables, and Cortex AI are all GA in us-east-1 (confirmed)
- Demo runs on an SE demo account with ACCOUNTADMIN role
- Actual production data is NOT used — all data is synthetic
- Pre-computed Cortex AI outputs are acceptable for demo purposes (live Cortex calls shown via SQL scripts)
- Interactive Warehouse XSMALL is sufficient for the demo data scale (< 500GB working set)
- Observe O4S datasets are already flowing from the demo account
