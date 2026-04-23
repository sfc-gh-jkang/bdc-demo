-- =============================================================================
-- BDC Agent Coaching Demo — Postgres Instance + Table DDL + Seed Commands
-- =============================================================================
-- Target: Snowflake Postgres instance on aws_spcs connection (us-east-1)
-- Usage: Run sections via pg_connect.py (instance creation) and psql (DDL + seed)
--
-- Prerequisites:
--   1. pg_connect.py --create for instance creation (see comments below)
--   2. psql service=bdc_pg for DDL and seed commands
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Create Postgres Instance (run via pg_connect.py, NOT psql)
-- ---------------------------------------------------------------------------
-- uv run --project ~/.cortex/skills/snowflake-postgres python \
--   ~/.cortex/skills/snowflake-postgres/scripts/pg_connect.py \
--   --create \
--   --instance-name BDC_PG \
--   --compute-pool STANDARD_M \
--   --storage 50 \
--   --auto-suspend-secs 3600 \
--   --snowflake-connection aws_spcs

-- ---------------------------------------------------------------------------
-- STEP 2: Table DDL (run via psql service=bdc_pg)
-- ---------------------------------------------------------------------------

-- Reference tables
CREATE TABLE IF NOT EXISTS dealers (
    dealer_id       INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    brand           TEXT NOT NULL,
    city            TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT 'FL',
    timezone        TEXT NOT NULL DEFAULT 'America/New_York'
);

CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id     INTEGER PRIMARY KEY,
    dealer_id       INTEGER NOT NULL REFERENCES dealers(dealer_id),
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    channel         TEXT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE,
    target_count    INTEGER NOT NULL DEFAULT 0,
    response_count  INTEGER NOT NULL DEFAULT 0,
    conversion_count INTEGER NOT NULL DEFAULT 0
);

-- Operational tables
CREATE TABLE IF NOT EXISTS agents (
    agent_id        INTEGER PRIMARY KEY,
    dealer_id       INTEGER NOT NULL REFERENCES dealers(dealer_id),
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    email           TEXT NOT NULL,
    hire_date       DATE NOT NULL,
    skill_tier      TEXT NOT NULL CHECK (skill_tier IN ('top', 'mid', 'bottom')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id     INTEGER PRIMARY KEY,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    phone           TEXT,
    email           TEXT,
    preferred_contact TEXT NOT NULL DEFAULT 'phone',
    opt_in_sms      BOOLEAN NOT NULL DEFAULT TRUE,
    opt_in_email    BOOLEAN NOT NULL DEFAULT TRUE,
    city            TEXT,
    state           TEXT DEFAULT 'FL'
);

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id      INTEGER PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    year            INTEGER NOT NULL,
    make            TEXT NOT NULL,
    model           TEXT NOT NULL,
    vin             TEXT NOT NULL,
    mileage         INTEGER NOT NULL DEFAULT 0,
    last_service_date DATE
);

CREATE TABLE IF NOT EXISTS service_history (
    service_id      INTEGER PRIMARY KEY,
    vehicle_id      INTEGER NOT NULL REFERENCES vehicles(vehicle_id),
    service_date    DATE NOT NULL,
    service_type    TEXT NOT NULL,
    mileage_at_service INTEGER NOT NULL,
    advisor_name    TEXT,
    total_cost      NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calls (
    call_id         INTEGER PRIMARY KEY,
    agent_id        INTEGER NOT NULL REFERENCES agents(agent_id),
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    campaign_id     INTEGER REFERENCES campaigns(campaign_id),
    call_date       DATE NOT NULL,
    call_time       TIME NOT NULL,
    duration_seconds INTEGER NOT NULL,
    direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    disposition     TEXT NOT NULL,
    connected_to_advisor BOOLEAN NOT NULL DEFAULT FALSE,
    phone_number    TEXT
);

CREATE TABLE IF NOT EXISTS call_transcripts (
    transcript_id   INTEGER PRIMARY KEY,
    call_id         INTEGER NOT NULL REFERENCES calls(call_id),
    transcript_json TEXT NOT NULL,
    transcript_text TEXT NOT NULL,
    word_count      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS call_scores (
    score_id        INTEGER PRIMARY KEY,
    call_id         INTEGER NOT NULL REFERENCES calls(call_id),
    greeting_score  NUMERIC(3,1) NOT NULL,
    needs_assessment_score NUMERIC(3,1) NOT NULL,
    objection_handling_score NUMERIC(3,1) NOT NULL,
    close_score     NUMERIC(3,1) NOT NULL,
    overall_score   NUMERIC(3,1) NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
    appointment_id  INTEGER PRIMARY KEY,
    call_id         INTEGER NOT NULL REFERENCES calls(call_id),
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    dealer_id       INTEGER NOT NULL REFERENCES dealers(dealer_id),
    appointment_type TEXT NOT NULL CHECK (appointment_type IN ('service', 'sales')),
    scheduled_date  DATE NOT NULL,
    scheduled_time  TIME NOT NULL,
    status          TEXT NOT NULL DEFAULT 'confirmed',
    show_status     TEXT NOT NULL DEFAULT 'showed'
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id         INTEGER PRIMARY KEY,
    agent_id        INTEGER NOT NULL REFERENCES agents(agent_id),
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    call_id         INTEGER REFERENCES calls(call_id),
    task_type       TEXT NOT NULL,
    due_date        DATE NOT NULL,
    completed_date  DATE,
    status          TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS text_messages (
    message_id      INTEGER PRIMARY KEY,
    agent_id        INTEGER NOT NULL REFERENCES agents(agent_id),
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    direction       TEXT NOT NULL DEFAULT 'outbound',
    message_text    TEXT NOT NULL,
    sent_at         TIMESTAMP NOT NULL,
    status          TEXT NOT NULL DEFAULT 'delivered'
);

CREATE TABLE IF NOT EXISTS email_logs (
    email_id        INTEGER PRIMARY KEY,
    campaign_id     INTEGER NOT NULL REFERENCES campaigns(campaign_id),
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    subject         TEXT NOT NULL,
    sent_at         TIMESTAMP NOT NULL,
    opened_at       TIMESTAMP,
    clicked_at      TIMESTAMP,
    status          TEXT NOT NULL DEFAULT 'delivered'
);

-- Analytics tables (pre-computed, loaded from generator)
CREATE TABLE IF NOT EXISTS call_ai_enrichments (
    call_id         INTEGER PRIMARY KEY REFERENCES calls(call_id),
    sentiment_score NUMERIC(4,3) NOT NULL,
    sentiment_label TEXT NOT NULL,
    call_summary    TEXT NOT NULL,
    disposition_class TEXT NOT NULL,
    follow_up_action TEXT,
    customer_objections TEXT,
    appointment_date_extracted DATE
);

CREATE TABLE IF NOT EXISTS agent_daily_metrics (
    agent_id        INTEGER NOT NULL REFERENCES agents(agent_id),
    metric_date     DATE NOT NULL,
    dealer_id       INTEGER NOT NULL REFERENCES dealers(dealer_id),
    calls_made      INTEGER NOT NULL DEFAULT 0,
    calls_connected INTEGER NOT NULL DEFAULT 0,
    avg_duration    NUMERIC(6,1) NOT NULL DEFAULT 0,
    avg_sentiment   NUMERIC(4,3) NOT NULL DEFAULT 0,
    appointments_set INTEGER NOT NULL DEFAULT 0,
    appointments_shown INTEGER NOT NULL DEFAULT 0,
    composite_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (agent_id, metric_date)
);

-- System table
CREATE TABLE IF NOT EXISTS pipeline_status (
    stage_name      TEXT PRIMARY KEY,
    stage_order     INTEGER NOT NULL,
    source_system   TEXT NOT NULL,
    target_system   TEXT NOT NULL,
    last_refresh_at TIMESTAMP NOT NULL DEFAULT NOW(),
    row_count       INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active',
    error_message   TEXT
);

-- ---------------------------------------------------------------------------
-- STEP 3: Seed data from CSV (run via psql service=bdc_pg)
-- ---------------------------------------------------------------------------
-- Order matters due to foreign key constraints.
-- Run from the project root: psql service=bdc_pg -f sql/01-postgres.sql
-- Or run each \copy individually.

\copy dealers FROM 'data/output/dealers.csv' WITH (FORMAT csv, HEADER true);
\copy agents FROM 'data/output/agents.csv' WITH (FORMAT csv, HEADER true);
\copy customers FROM 'data/output/customers.csv' WITH (FORMAT csv, HEADER true);
\copy vehicles FROM 'data/output/vehicles.csv' WITH (FORMAT csv, HEADER true);
\copy service_history FROM 'data/output/service_history.csv' WITH (FORMAT csv, HEADER true);
\copy campaigns FROM 'data/output/campaigns.csv' WITH (FORMAT csv, HEADER true);
\copy calls FROM 'data/output/calls.csv' WITH (FORMAT csv, HEADER true);
\copy call_transcripts FROM 'data/output/call_transcripts.csv' WITH (FORMAT csv, HEADER true);
\copy call_scores FROM 'data/output/call_scores.csv' WITH (FORMAT csv, HEADER true);
\copy appointments FROM 'data/output/appointments.csv' WITH (FORMAT csv, HEADER true);
\copy tasks FROM 'data/output/tasks.csv' WITH (FORMAT csv, HEADER true);
\copy text_messages FROM 'data/output/text_messages.csv' WITH (FORMAT csv, HEADER true);
\copy email_logs FROM 'data/output/email_logs.csv' WITH (FORMAT csv, HEADER true);
\copy call_ai_enrichments FROM 'data/output/call_ai_enrichments.csv' WITH (FORMAT csv, HEADER true);
\copy agent_daily_metrics FROM 'data/output/agent_daily_metrics.csv' WITH (FORMAT csv, HEADER true);
\copy pipeline_status FROM 'data/output/pipeline_status.csv' WITH (FORMAT csv, HEADER true);

-- ---------------------------------------------------------------------------
-- STEP 4: Verify row counts
-- ---------------------------------------------------------------------------
SELECT 'dealers' AS entity, COUNT(*) AS rows FROM dealers
UNION ALL SELECT 'agents', COUNT(*) FROM agents
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL SELECT 'service_history', COUNT(*) FROM service_history
UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL SELECT 'calls', COUNT(*) FROM calls
UNION ALL SELECT 'call_transcripts', COUNT(*) FROM call_transcripts
UNION ALL SELECT 'call_scores', COUNT(*) FROM call_scores
UNION ALL SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'text_messages', COUNT(*) FROM text_messages
UNION ALL SELECT 'email_logs', COUNT(*) FROM email_logs
UNION ALL SELECT 'call_ai_enrichments', COUNT(*) FROM call_ai_enrichments
UNION ALL SELECT 'agent_daily_metrics', COUNT(*) FROM agent_daily_metrics
UNION ALL SELECT 'pipeline_status', COUNT(*) FROM pipeline_status
ORDER BY entity;
