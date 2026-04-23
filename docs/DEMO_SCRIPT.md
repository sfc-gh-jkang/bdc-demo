# BDC Coaching Demo — 20-25 min walkthrough

**Audience:** Contact center / BDC / auto dealer group stakeholders, or any SE demoing "Snowflake-native AI app" patterns.

**Prereqs:**
- Demo deployed via `bash deploy/spcs/deploy-spcs.sh` (~15 min, ~2-3 credits)
- SSO logged into the SPCS endpoint (Prisma Access Browser if on corp laptop)
- Snowsight tab open to `BDC_DEMO` database

---

## Opening (2 min)

**Hook:** "Every call center has the same problem — thousands of calls a day, a handful of QA analysts listening to maybe 2%. The patterns that matter are in the 98% nobody heard."

**Frame:** "I'll show you a coaching dashboard that scores every call, surfaces the patterns, and does the whole thing inside the customer's own Snowflake account. Same category as Gong / CallMiner / Observe.AI — different architecture."

---

## 1. Dashboard (3 min) — `/`

What to show:
- KPI tiles: total calls, avg coaching score, top/bottom performers
- Trend chart — coaching score over time
- "This is 15K synthetic calls across 30 agents at 5 locations"

Talk track:
- "Every tile here is a query against Interactive Tables — sub-second even at 15K rows"
- "All AI-generated fields (score, summary, disposition, sentiment) are produced by Cortex Agent on ingest"

---

## 2. Leaderboard (2 min) — `/leaderboard`

What to show:
- Agent ranking, filterable by location
- Click into a low-performer

Talk track:
- "This is where a BDC manager would start their day — who needs coaching today"

---

## 3. Agent detail + streaming coaching summary (5 min) — `/agents/:id`

What to show:
- Per-agent metrics + recent calls
- Click **Generate Coaching Summary** → streaming claude-4-sonnet response
- Citations pop out — click one, jump to the source transcript

Talk track:
- "This is Cortex Agent orchestrating claude-4-sonnet + Cortex Search over the transcripts"
- "No vector DB. No OpenAI. The retrieval is Cortex Search, grounded on the actual Iceberg table"
- "When the manager asks 'why did you recommend that coaching focus?' — we show the transcript citation, not a hallucinated paragraph"

---

## 4. Call detail (3 min) — `/calls/:id`

What to show:
- Full transcript + AI-generated: summary, disposition, sentiment, 7 coaching dimensions, follow-ups
- Highlight one coaching dimension ("Objection handling: 3/5 — agent didn't reprice after financing pushback")

Talk track:
- "Every one of those fields was generated once at ingest and materialized into the table — no repeated LLM calls on page load"

---

## 5. Call log + Analyst (3 min) — `/calls`, `/analyst`

What to show:
- Searchable/filterable call list
- **Analyst** page — natural language over the call data via Cortex Analyst
- Example prompt: "Which agents had the biggest drop in objection handling this week?"

Talk track:
- "Same account, same data — now surfaced through text-to-SQL. No separate BI tool"

---

## 6. Pipeline (3 min) — `/pipeline`

What to show:
- Live view of Iceberg tables → Dynamic Tables → Interactive Tables
- Row counts, last refresh times
- Daily task that generates new calls

Talk track:
- "This is the whole architecture on one page"
- "Iceberg is the canonical store. Dynamic Tables refresh aggregates on a TARGET_LAG (no Airflow). Interactive Tables power the dashboard"
- "SPCS hosts the React + FastAPI + nginx app right here, inside the security boundary"

---

## Close (2-3 min)

Emphasize:
- **One bill, one security boundary, one deploy command**
- **No call data leaves Snowflake**
- **No vector DB, no scheduler, no separate hosting, no cross-cloud plumbing**
- **Deploy in ~15 min, teardown included**

Transitions to common questions:
- "Can we use real call data?" → "Yes — swap the synthetic generator for your actual transcripts; everything downstream is the same"
- "What about live/streaming calls?" → "Openflow or Snowpipe Streaming into the Iceberg tables; rest of the pipeline is unchanged"
- "Custom coaching rubric?" → "7 dimensions are set in the Cortex Agent prompt — edit `sql/03-cortex-objects.sql`"

---

## Troubleshooting during demo

| Symptom | Fix |
|---|---|
| SSO redirect loop | Use Prisma Access Browser, not Chrome, on corp laptop |
| Streaming coaching summary hangs | Check SPCS service logs: `SELECT SYSTEM$GET_SERVICE_LOGS('BDC_DEMO.SPCS.BDC_COACHING_SERVICE', 0, 'backend')` |
| Dashboard tile empty | Interactive WH may be suspended — refresh triggers resume; or `ALTER WAREHOUSE BDC_INTERACTIVE_WH RESUME` |
| Analyst returns "no semantic model" | `sql/04-semantic-model.sql` didn't load — rerun that file |

---

## Teardown

```bash
bash deploy/spcs/teardown.sh
```

Drops database, service, compute pool, image repo. ~2 min.
