# AGENTS.md — BDC Agent Coaching Dashboard

Project-specific guidance for AI coding assistants working in this repo.
Global personal conventions live in `~/CLAUDE.md` — do not duplicate them here.

## Project Overview

BDC (Business Development Center) Agent Coaching Dashboard: a Snowflake SPCS
demo that combines synthetic call/transcript data, Cortex AI enrichment, and a
React + FastAPI frontend to showcase agent coaching workflows for automotive
retail / call-center coaching use cases.

## Stack

- **Backend**: FastAPI + `snowflake-connector-python` (`backend/pyproject.toml`)
- **Frontend**: React 19 + Vite + Tailwind 4 + Recharts (`frontend/package.json`)
- **Data**: Synthetic CSV/Parquet generated via scripts in `data/` (pandas + pyarrow)
- **Warehouse**: Dual-warehouse pattern — standard `BDC_STD_WH` for most queries,
  `BDC_INTERACTIVE_WH` (Interactive Warehouse) for sub-second dashboard queries
  against Interactive Tables in the `COACHING` schema
- **Storage**: Snowflake-managed Iceberg tables (`CATALOG='SNOWFLAKE'`) in `RAW` schema —
  no external volumes, no pg_lake, no S3
- **Compute**: SPCS service on `BDC_POOL` compute pool

## Connection

Use `aws_spcs` connection (SE demo account, ACCOUNTADMIN, FULLSTACK_WH).
Never run this project against Snowhouse or customer accounts.

## Key Commands

```bash
bash deploy.sh              # Full SPCS deploy (reads deploy/deploy.env)
bash teardown.sh            # Interactive teardown
bash teardown.sh --nuclear  # Drop entire database CASCADE
bash test-checklist.sh      # Post-deploy smoke tests
```

## Architecture Notes

- **Interactive Table constraint**: Interactive warehouses can *only* query
  Interactive Tables — not regular tables or DTs. Routes that hit `COACHING`
  schema (coached calls, scores) pass `interactive=True` to the pool helper;
  routes hitting `RAW` use the default standard warehouse.
- **SSE streaming for Cortex Agent**: Agent responses take 5–30s. Backend uses
  `run_agent_stream_with_metadata()` yielding `response.text.delta` chunks;
  frontend uses `fetch()` + `getReader()` + `TextDecoder` with a `delta` / `metadata`
  / `done` event protocol. Never switch back to batch JSON — UX degrades badly.
- **Daily synthetic data task**: Uses `CURRENT_DATE()` as target, *not*
  `DATEADD('day', 1, MAX(date_col))`. Includes idempotency guard
  `IF (max_date >= target_date) THEN RETURN 'skipped'`. Column names:
  `CALL_SCORES.CREATED_AT` (not `SCORED_AT`), `CALL_AI_ENRICHMENTS.PROCESSED_AT`
  + `CREATED_AT` (not `ENRICHED_AT`) — always `DESCRIBE TABLE` before writing
  INSERT procs.

## Cortex Agent

- Only claude models are allowed on the Cortex Agent API — `claude-4-sonnet`
  recommended. `claude-3-5-sonnet` is deprecated. `llama`/`mistral` are not
  allowed for agents (use with `CORTEX.COMPLETE()` SQL only).
- SSE event routing: `response.text.delta` = extract, `response.thinking.delta`
  = skip, `response.status` + `response.tool_use` = forward as `__status__`,
  `response.tool_result` = skip, `response.text` = skip (already streamed).

## SPCS Gotchas

- `ALTER SERVICE SUSPEND/RESUME` does not update the spec. To change env vars,
  re-upload the rendered spec to stage first, then `ALTER SERVICE ... FROM @stage/...`.
- Images must use unique tags (git SHA or timestamp), not `:latest` — SPCS
  caches aggressively.
- After any deploy, display the endpoint URL (via `SHOW ENDPOINTS IN SERVICE`
  or `SYSTEM$GET_SERVICE_STATUS`). Never make the user ask.

## Data

- All data under `data/output/` is **synthetic** — fabricated names, placeholder
  `@gmail.com` emails, random FL area codes. No real customer PII.
- Do not commit real data. `.gitignore` should exclude any `*.real.*` fixtures.

## License

Apache-2.0. Owner: John Kang (john.kang@snowflake.com / @sfc-gh-jkang).
