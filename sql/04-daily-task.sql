-- =============================================================================
-- 04: Daily Call Generator → Snowflake-Managed Iceberg Tables
-- =============================================================================
-- Data path: Python SP generates synthetic calls → INSERT directly into
-- Snowflake-managed Iceberg tables → DTs auto-refresh → ITs auto-refresh.
--
-- No Postgres, no pg_lake, no S3, no external volume.
-- =============================================================================

USE ROLE ACCOUNTADMIN;
USE WAREHOUSE BDC_STD_WH;

-- ── Daily Call Generator SP ─────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE BDC_DEMO.RAW.GENERATE_DAILY_CALLS()
RETURNS VARCHAR
LANGUAGE PYTHON
RUNTIME_VERSION = '3.11'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'run'
EXECUTE AS CALLER
AS
$$
import random
from datetime import datetime, timedelta

def run(session):
    """Generate ~500 synthetic calls for today and INSERT into Snowflake Iceberg tables."""

    # ── Determine target date: use CURRENT_DATE ──
    target_date_row = session.sql("SELECT CURRENT_DATE AS td").collect()
    target_date = target_date_row[0]['TD']

    # ── Check if data already exists for this date ──
    existing = session.sql(
        f"SELECT COUNT(*) AS cnt FROM BDC_DEMO.RAW.CALLS_ICEBERG WHERE CALL_DATE = '{target_date}'"
    ).collect()
    if existing[0]['CNT'] > 0:
        return f"Data already exists for {target_date} ({existing[0]['CNT']} calls). Skipping."

    # ── Get current ID offsets from Iceberg tables ──
    offsets = {}
    for tbl, col, prefix in [
        ('CALLS_ICEBERG', 'CALL_ID', 'CALL'),
        ('CALL_TRANSCRIPTS_ICEBERG', 'TRANSCRIPT_ID', 'TRN'),
        ('CALL_SCORES_ICEBERG', 'SCORE_ID', 'SCR'),
        ('CALL_AI_ENRICHMENTS_ICEBERG', 'ENRICHMENT_ID', 'ENR'),
        ('AGENT_DAILY_METRICS_ICEBERG', 'METRIC_ID', 'MET'),
        ('APPOINTMENTS_ICEBERG', 'APPOINTMENT_ID', 'APT'),
    ]:
        row = session.sql(
            f"SELECT CAST(REPLACE(MAX({col}), '{prefix}', '') AS NUMBER) AS mx FROM BDC_DEMO.RAW.{tbl}"
        ).collect()
        offsets[prefix] = int(row[0]['MX']) if row[0]['MX'] is not None else 0

    # ── Get agents and campaigns from Snowflake ──
    agents = session.sql(
        "SELECT AGENT_ID, DEALER_ID, SKILL_TIER FROM BDC_DEMO.RAW.AGENTS WHERE IS_ACTIVE = TRUE"
    ).collect()

    campaigns = session.sql(
        "SELECT DEALER_ID, CAMPAIGN_ID FROM BDC_DEMO.RAW.CAMPAIGNS"
    ).collect()
    dealer_campaigns = {}
    for c in campaigns:
        dlr = c['DEALER_ID']
        if dlr not in dealer_campaigns:
            dealer_campaigns[dlr] = []
        dealer_campaigns[dlr].append(c['CAMPAIGN_ID'])

    customers = session.sql(
        "SELECT CUSTOMER_ID FROM BDC_DEMO.RAW.CUSTOMERS"
    ).collect()
    customer_ids = [c['CUSTOMER_ID'] for c in customers]

    # ── Seed random with target date for reproducibility ──
    random.seed(str(target_date))
    num_calls = random.randint(450, 550)

    dispositions_weighted = (
        ['do_not_call'] * 2 + ['wrong_number'] * 3 + ['complaint'] * 5 +
        ['callback_requested'] * 10 + ['information_provided'] * 10 +
        ['no_answer'] * 14 + ['voicemail'] * 25 + ['appointment_set'] * 31
    )

    calls = []
    call_transcripts = []
    call_scores = []
    call_enrichments = []
    appointments = []

    for i in range(1, num_calls + 1):
        call_id = f"CALL{offsets['CALL'] + i:06d}"
        agent = random.choice(agents)
        agent_id = agent['AGENT_ID']
        dealer_id = agent['DEALER_ID']
        customer_id = random.choice(customer_ids)
        dlr_camps = dealer_campaigns.get(dealer_id, [])
        campaign_id = random.choice(dlr_camps) if dlr_camps else None

        hour = random.randint(8, 17)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        call_dt = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=hour, minutes=minute, seconds=second)

        duration = random.randint(30, 600)
        disposition = random.choice(dispositions_weighted)
        direction = random.choice(['outbound'] * 70 + ['inbound'] * 30)
        call_type = random.choice(['live_connect', 'follow_up', 'cold_call', 'warm_call'])
        recording_url = f"s3://bdc-recordings/{dealer_id}/{target_date}/{call_id}.wav"

        calls.append((
            call_id, dealer_id, agent_id, customer_id, campaign_id,
            call_dt, target_date, duration, disposition, direction,
            call_type, recording_url, call_dt
        ))

        # call_transcripts
        trn_id = f"TRN{offsets['TRN'] + i:06d}"
        word_count = random.randint(50, 800)
        transcript_text = f"[Synthetic transcript for {call_id}] Agent greeted customer and discussed {disposition}. Duration: {duration}s."
        transcript_json = '[]'
        call_transcripts.append((
            trn_id, call_id, transcript_json, transcript_text, word_count, None, call_dt
        ))

        # call_scores
        scr_id = f"SCR{offsets['SCR'] + i:06d}"
        tier = agent['SKILL_TIER']
        base_s = {'top': 75, 'mid': 50}.get(tier, 30)
        rng_s = {'top': 25, 'mid': 40}.get(tier, 45)
        greeting = base_s + random.randint(0, rng_s)
        active_listening = base_s + random.randint(0, rng_s)
        objection_handling = base_s + random.randint(0, rng_s)
        product_knowledge = base_s + random.randint(0, rng_s)
        closing = base_s + random.randint(0, rng_s)
        professionalism = base_s + random.randint(0, rng_s)
        overall = round((greeting + active_listening + objection_handling + product_knowledge + closing + professionalism) / 6)
        call_scores.append((
            scr_id, call_id, agent_id, greeting, active_listening, objection_handling,
            product_knowledge, closing, professionalism, overall,
            'AI', None, call_dt
        ))

        # call_ai_enrichments
        enr_id = f"ENR{offsets['ENR'] + i:06d}"
        sent_map = {
            'appointment_set': (0.6, 0.4, 'positive'),
            'information_provided': (0.4, 0.3, 'neutral'),
            'callback_requested': (0.2, 0.4, 'neutral'),
            'complaint': (0.0, 0.2, 'negative'),
        }
        base_sent, rng_sent, label = sent_map.get(disposition, (0.1, 0.5, 'neutral'))
        sentiment = round(base_sent + random.random() * rng_sent, 3)

        summary_map = {
            'appointment_set': 'Customer agreed to schedule a service appointment. Agent demonstrated good rapport.',
            'voicemail': 'Left voicemail message with callback information. No live contact made.',
            'callback_requested': 'Customer requested a callback at a more convenient time.',
            'no_answer': 'Call went unanswered. No voicemail left.',
            'information_provided': 'Customer had questions about existing service. Agent provided helpful information.',
            'complaint': 'Customer expressed dissatisfaction with previous service experience. Escalated to manager.',
            'wrong_number': 'Wrong number reached. Contact information needs updating.',
            'do_not_call': 'Customer requested to be placed on do-not-call list.',
        }
        summary = summary_map.get(disposition, 'Call completed with standard disposition.')

        disp_class_map = {
            'appointment_set': 'service_appointment', 'voicemail': 'no_contact',
            'callback_requested': 'callback_request', 'information_provided': 'information_only',
            'complaint': 'escalation',
        }
        disp_class = disp_class_map.get(disposition, 'no_action')

        follow_up_map = {
            'appointment_set': 'Send confirmation text', 'callback_requested': 'Schedule follow-up call',
            'voicemail': 'Retry call tomorrow', 'complaint': 'Manager follow-up required',
        }
        follow_up = follow_up_map.get(disposition, None)

        objections = None
        if disposition == 'complaint':
            objections = 'Service wait time, communication'
        elif disposition == 'callback_requested':
            objections = 'Timing inconvenience'

        appt_date = None
        if disposition == 'appointment_set':
            appt_date = target_date + timedelta(days=random.randint(1, 7))

        call_enrichments.append((
            enr_id, call_id, sentiment, label, summary, disp_class,
            follow_up, objections, appt_date,
            'cortex-llm-v1.2', call_dt, call_dt
        ))

        # appointments
        if disposition == 'appointment_set':
            apt_id = f"APT{offsets['APT'] + len(appointments) + 1:05d}"
            apt_days = random.randint(1, 7)
            apt_hour = random.randint(8, 16)
            apt_dt = datetime.combine(target_date + timedelta(days=apt_days), datetime.min.time()) + timedelta(hours=apt_hour)
            apt_date = target_date + timedelta(days=apt_days)
            apt_type = random.choice(['service'] * 70 + ['sales'] * 30)
            apt_status = random.choice(['confirmed'] * 90 + ['pending'] * 10)
            apt_dur = 30 + random.randint(0, 60)
            appointments.append((
                apt_id, call_id, dealer_id, agent_id, customer_id,
                apt_dt, apt_date, apt_type, apt_status, apt_dur, None, call_dt
            ))

    # ── Compute agent daily metrics ──
    agent_metrics = {}
    for idx, c in enumerate(calls):
        aid = c[2]
        did = c[1]
        disp = c[8]
        dur = c[7]
        if aid not in agent_metrics:
            agent_metrics[aid] = {
                'dealer_id': did, 'total': 0, 'connected': 0,
                'appts': 0, 'vms': 0, 'durations': [], 'scores': []
            }
        m = agent_metrics[aid]
        m['total'] += 1
        if disp not in ('no_answer', 'wrong_number'):
            m['connected'] += 1
        if disp == 'appointment_set':
            m['appts'] += 1
        if disp == 'voicemail':
            m['vms'] += 1
        m['durations'].append(dur)
        m['scores'].append(call_scores[idx][9])

    metrics_rows = []
    met_counter = 0
    for aid, m in agent_metrics.items():
        met_counter += 1
        met_id = f"MET{offsets['MET'] + met_counter:06d}"
        avg_handle = round(sum(m['durations']) / len(m['durations']))
        total_talk = sum(m['durations'])
        conv_rate = round(m['appts'] / m['total'], 3) if m['total'] > 0 else 0
        avg_score = round(sum(m['scores']) / len(m['scores'])) if m['scores'] else 0
        metrics_rows.append((
            met_id, aid, m['dealer_id'], target_date,
            m['total'], m['connected'], m['appts'], m['vms'],
            avg_handle, total_talk, conv_rate, avg_score,
            target_date
        ))

    # ── INSERT directly into Snowflake-managed Iceberg tables ──
    def _escape(v):
        """Escape a value for SQL literal insertion."""
        if v is None:
            return 'NULL'
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, datetime):
            return f"'{v.isoformat()}'::TIMESTAMP_NTZ"
        # date-like objects from Snowflake come as date type
        if hasattr(v, 'isoformat'):
            return f"'{v.isoformat()}'"
        s = str(v).replace("'", "''")
        return f"'{s}'"

    def _batch_insert(table, columns, rows, batch_size=100):
        """Insert rows in batches using multi-row VALUES."""
        for start in range(0, len(rows), batch_size):
            batch = rows[start:start + batch_size]
            values_strs = []
            for row in batch:
                vals = ', '.join(_escape(v) for v in row)
                values_strs.append(f'({vals})')
            cols = ', '.join(columns)
            sql = f"INSERT INTO BDC_DEMO.RAW.{table} ({cols}) VALUES {', '.join(values_strs)}"
            session.sql(sql).collect()

    # 1. Calls
    _batch_insert('CALLS_ICEBERG',
        ['CALL_ID', 'DEALER_ID', 'AGENT_ID', 'CUSTOMER_ID', 'CAMPAIGN_ID',
         'CALL_DATETIME', 'CALL_DATE', 'DURATION_SECONDS', 'DISPOSITION',
         'DIRECTION', 'CALL_TYPE', 'RECORDING_URL', 'CREATED_AT'],
        calls)

    # 2. Transcripts
    _batch_insert('CALL_TRANSCRIPTS_ICEBERG',
        ['TRANSCRIPT_ID', 'CALL_ID', 'TRANSCRIPT_JSON', 'TRANSCRIPT_TEXT',
         'WORD_COUNT', 'SCENARIO_TEMPLATE', 'CREATED_AT'],
        call_transcripts)

    # 3. Scores
    _batch_insert('CALL_SCORES_ICEBERG',
        ['SCORE_ID', 'CALL_ID', 'AGENT_ID', 'GREETING', 'ACTIVE_LISTENING',
         'OBJECTION_HANDLING', 'PRODUCT_KNOWLEDGE', 'CLOSING', 'PROFESSIONALISM',
         'OVERALL_SCORE', 'SCORED_BY', 'NOTES', 'CREATED_AT'],
        call_scores)

    # 4. Enrichments
    _batch_insert('CALL_AI_ENRICHMENTS_ICEBERG',
        ['ENRICHMENT_ID', 'CALL_ID', 'SENTIMENT_SCORE', 'SENTIMENT_LABEL',
         'CALL_SUMMARY', 'DISPOSITION_CLASS', 'FOLLOW_UP_ACTION',
         'CUSTOMER_OBJECTIONS', 'APPOINTMENT_DATE_EXTRACTED',
         'MODEL_VERSION', 'PROCESSED_AT', 'CREATED_AT'],
        call_enrichments)

    # 5. Appointments
    if appointments:
        _batch_insert('APPOINTMENTS_ICEBERG',
            ['APPOINTMENT_ID', 'CALL_ID', 'DEALER_ID', 'AGENT_ID', 'CUSTOMER_ID',
             'APPOINTMENT_DATETIME', 'APPOINTMENT_DATE', 'APPOINTMENT_TYPE',
             'STATUS', 'DURATION_MINUTES', 'NOTES', 'CREATED_AT'],
            appointments)

    # 6. Agent daily metrics
    _batch_insert('AGENT_DAILY_METRICS_ICEBERG',
        ['METRIC_ID', 'AGENT_ID', 'DEALER_ID', 'METRIC_DATE',
         'TOTAL_CALLS', 'CONNECTED_CALLS', 'APPOINTMENTS_SET', 'VOICEMAILS_LEFT',
         'AVG_HANDLE_TIME_SECONDS', 'TOTAL_TALK_TIME_SECONDS',
         'CONVERSION_RATE', 'AVG_CALL_SCORE', 'CREATED_AT'],
        metrics_rows)

    return (
        f"Generated {num_calls} calls for {target_date} -> Snowflake Iceberg tables. "
        f"({len(call_transcripts)} transcripts, {len(call_scores)} scores, "
        f"{len(call_enrichments)} enrichments, {len(appointments)} appointments, "
        f"{len(metrics_rows)} agent metrics)."
    )
$$;

-- ── Daily Call Generator Task (10 AM ET) ────────────────────────────────────
CREATE OR REPLACE TASK BDC_DEMO.RAW.DAILY_CALL_GENERATOR
  WAREHOUSE = BDC_STD_WH
  SCHEDULE = 'USING CRON 0 10 * * * America/New_York'
  COMMENT = 'Generate daily synthetic calls -> Snowflake-managed Iceberg tables'
AS
  CALL BDC_DEMO.RAW.GENERATE_DAILY_CALLS();

ALTER TASK BDC_DEMO.RAW.DAILY_CALL_GENERATOR RESUME;
