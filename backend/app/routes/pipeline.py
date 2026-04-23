"""Pipeline status — live Snowflake object metadata.

Queries actual Snowflake metadata (SHOW commands, INFORMATION_SCHEMA,
SYSTEM$GET_SERVICE_STATUS) to build a tiered view of every object
powering the demo.
"""

import json
import logging
import os
from datetime import datetime

from fastapi import APIRouter

import snowflake.connector

from app.db import fetch_all, get_connection

router = APIRouter()
logger = logging.getLogger(__name__)

_STD_WH = os.environ.get("SNOWFLAKE_STD_WAREHOUSE", "BDC_STD_WH")
_DATABASE = os.environ.get("SNOWFLAKE_DATABASE", "BDC_DEMO")


def _ts(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v)


def _safe_int(v) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


# ── helpers ──────────────────────────────────────────────────────────────────


def _query_raw(sql: str) -> list[dict]:
    """Run a query on the standard warehouse, return rows as lowercase dicts."""
    with get_connection() as conn:
        cur = conn.cursor(snowflake.connector.DictCursor)
        try:
            cur.execute(f"USE WAREHOUSE {_STD_WH}")
            cur.execute(sql)
            rows = cur.fetchall()
            return [{k.lower(): v for k, v in row.items()} for row in rows]
        finally:
            try:
                from app.db import _WAREHOUSE
                cur.execute(f"USE WAREHOUSE {_WAREHOUSE}")
            except Exception:
                pass
            cur.close()


def _get_raw_table_counts() -> list[dict]:
    """Row counts and freshness for RAW tables (Iceberg + reference).

    Iceberg tables are the live pipeline tables fed by Postgres → pg_lake.
    Reference tables (AGENTS, CUSTOMERS, DEALERS, etc.) are direct-loaded.
    """
    sql = """
        SELECT TABLE_NAME AS name,
               ROW_COUNT AS cnt,
               IS_ICEBERG = 'YES' AS is_iceberg,
               LAST_ALTERED AS last_refreshed
        FROM BDC_DEMO.INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'RAW'
          AND TABLE_NAME IN (
              'CALLS_ICEBERG', 'CALL_TRANSCRIPTS_ICEBERG', 'CALL_SCORES_ICEBERG',
              'CALL_AI_ENRICHMENTS_ICEBERG', 'APPOINTMENTS_ICEBERG',
              'AGENT_DAILY_METRICS_ICEBERG',
              'AGENTS', 'CUSTOMERS', 'DEALERS', 'VEHICLES', 'CAMPAIGNS'
          )
        ORDER BY TABLE_NAME
    """
    return _query_raw(sql)


def _get_iceberg_freshness() -> str | None:
    """Latest CALL_DATE across Iceberg tables as a freshness indicator."""
    sql = "SELECT MAX(CALL_DATE) AS latest FROM BDC_DEMO.RAW.CALLS_ICEBERG"
    try:
        rows = _query_raw(sql)
        if rows:
            return _ts(rows[0].get("latest"))
    except Exception:
        pass
    return None


def _get_dynamic_tables() -> list[dict]:
    """SHOW DYNAMIC TABLES metadata."""
    rows = _query_raw(f"SHOW DYNAMIC TABLES IN DATABASE {_DATABASE}")
    return [
        {
            "name": r.get("name"),
            "schema": r.get("schema_name"),
            "rows": _safe_int(r.get("rows")),
            "target_lag": r.get("target_lag"),
            "scheduling_state": r.get("scheduling_state"),
            "refresh_mode": r.get("refresh_mode"),
            "warehouse": r.get("warehouse"),
        }
        for r in rows
    ]


def _get_interactive_tables() -> list[dict]:
    """Discover Interactive Tables in the COACHING schema.

    Tries SHOW INTERACTIVE TABLES first (cleaner output with target_lag).
    Falls back to SHOW TABLES filtered by is_interactive='Y' if the
    command isn't available on the connector version.
    """
    try:
        rows = _query_raw(f"SHOW INTERACTIVE TABLES IN SCHEMA {_DATABASE}.COACHING")
        return [
            {
                "name": r.get("name"),
                "schema": r.get("schema_name"),
                "rows": _safe_int(r.get("rows")),
                "target_lag": r.get("target_lag"),
                "scheduling_state": r.get("scheduling_state"),
                "refresh_mode": None,
                "warehouse": r.get("refresh_warehouse"),
            }
            for r in rows
        ]
    except Exception:
        pass

    # Fallback: SHOW TABLES filtered by is_interactive
    try:
        rows = _query_raw(f"SHOW TABLES IN SCHEMA {_DATABASE}.COACHING")
        return [
            {
                "name": r.get("name"),
                "schema": r.get("schema_name"),
                "rows": _safe_int(r.get("rows")),
                "target_lag": None,
                "scheduling_state": None,
                "refresh_mode": None,
                "warehouse": None,
            }
            for r in rows
            if r.get("is_interactive") == "Y"
        ]
    except Exception:
        return []


def _get_dt_refresh_history() -> list[dict]:
    """Latest refresh per Dynamic Table from INFORMATION_SCHEMA.

    DOWNSTREAM DTs (target_lag='DOWNSTREAM') often have no entries in
    DYNAMIC_TABLE_REFRESH_HISTORY because they only refresh when a
    downstream consumer triggers them.  We fall back to the
    ``data_timestamp`` from SHOW DYNAMIC TABLES for those.
    """
    sql = """
        SELECT
            name,
            schema_name,
            state,
            data_timestamp,
            refresh_start_time,
            refresh_end_time,
            DATEDIFF('second', refresh_start_time, refresh_end_time) AS duration_secs,
            statistics:numInsertedRows::INT AS rows_inserted
        FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY())
        WHERE database_name = 'BDC_DEMO'
          AND state = 'SUCCEEDED'
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY database_name, schema_name, name
            ORDER BY refresh_start_time DESC
        ) = 1
        ORDER BY schema_name, name
    """
    rows = _query_raw(sql)
    return [
        {
            "name": r.get("name"),
            "schema": r.get("schema_name"),
            "state": r.get("state"),
            "last_refresh": _ts(r.get("refresh_end_time")),
            "duration_secs": _safe_int(r.get("duration_secs")),
            "rows_inserted": _safe_int(r.get("rows_inserted")),
        }
        for r in rows
    ]


def _get_dynamic_table_data_timestamps() -> dict[tuple[str, str], str]:
    """Return {(schema, name): data_timestamp} from SHOW DYNAMIC TABLES.

    Used as a fallback for DOWNSTREAM DTs that have no refresh history.
    """
    rows = _query_raw(f"SHOW DYNAMIC TABLES IN DATABASE {_DATABASE}")
    result: dict[tuple[str, str], str] = {}
    for r in rows:
        schema = r.get("schema_name")
        name = r.get("name")
        dt_ts = r.get("data_timestamp")
        if schema and name and dt_ts:
            result[(schema, name)] = _ts(dt_ts)  # type: ignore[arg-type]
    return result


def _get_cortex_search() -> list[dict]:
    """SHOW CORTEX SEARCH SERVICES metadata."""
    rows = _query_raw("SHOW CORTEX SEARCH SERVICES IN SCHEMA BDC_DEMO.COACHING")
    return [
        {
            "name": r.get("name"),
            "search_column": r.get("search_column"),
            "rows": _safe_int(r.get("source_data_num_rows")),
            "indexing_state": r.get("indexing_state"),
            "serving_state": r.get("serving_state"),
            "embedding_model": r.get("embedding_model"),
            "target_lag": r.get("target_lag"),
            "warehouse": r.get("warehouse"),
        }
        for r in rows
    ]


def _get_agents() -> list[dict]:
    """SHOW AGENTS metadata."""
    rows = _query_raw("SHOW AGENTS IN SCHEMA BDC_DEMO.COACHING")
    return [
        {
            "name": r.get("name"),
            "created_on": _ts(r.get("created_on")),
            "comment": r.get("comment"),
        }
        for r in rows
    ]


def _get_spcs_status() -> list[dict]:
    """SYSTEM$GET_SERVICE_STATUS for the SPCS service."""
    sql = "SELECT SYSTEM$GET_SERVICE_STATUS('BDC_DEMO.SPCS.BDC_COACHING_SERVICE') AS status_json"
    rows = _query_raw(sql)
    if not rows:
        return []
    raw = rows[0].get("status_json", "[]")
    try:
        containers = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    return [
        {
            "name": c.get("containerName"),
            "status": c.get("status"),
            "message": c.get("message"),
            "restart_count": c.get("restartCount"),
            "start_time": c.get("startTime"),
            "image": c.get("image", "").split(":")[-1] if c.get("image") else None,
        }
        for c in containers
    ]


def _get_tasks() -> list[dict]:
    """SHOW TASKS metadata."""
    rows = _query_raw(f"SHOW TASKS IN DATABASE {_DATABASE}")
    result = []
    for r in rows:
        result.append({
            "name": r.get("name"),
            "schema": r.get("schema_name"),
            "schedule": r.get("schedule"),
            "state": r.get("state"),
            "warehouse": r.get("warehouse"),
            "definition": r.get("definition"),
            "last_committed_on": _ts(r.get("last_committed_on")),
        })
    return result


def _get_task_history() -> list[dict]:
    """Recent task executions from INFORMATION_SCHEMA.

    Filters out rows with state='SCHEDULED' and no query_start_time —
    these represent the *definition* of a scheduled task, not an actual run.
    """
    sql = """
        SELECT name, schema_name, state, query_start_time, completed_time,
               DATEDIFF('second', query_start_time, completed_time) AS duration_secs,
               error_code, error_message
        FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY(
            RESULT_LIMIT => 10
        ))
        WHERE database_name = 'BDC_DEMO'
          AND query_start_time IS NOT NULL
        ORDER BY query_start_time DESC
    """
    try:
        rows = _query_raw(sql)
    except Exception:
        return []
    return [
        {
            "name": r.get("name"),
            "schema": r.get("schema_name"),
            "state": r.get("state"),
            "started_at": _ts(r.get("query_start_time")),
            "completed_at": _ts(r.get("completed_time")),
            "duration_secs": _safe_int(r.get("duration_secs")),
            "error": r.get("error_message"),
        }
        for r in rows
    ]


def _get_call_date_range() -> dict:
    """Min/max call dates for the data freshness indicator."""
    sql = "SELECT MIN(CALL_DATE) AS min_date, MAX(CALL_DATE) AS max_date, COUNT(*) AS total FROM BDC_DEMO.RAW.CALLS_ICEBERG"
    rows = _query_raw(sql)
    if not rows:
        return {}
    r = rows[0]
    return {
        "min_date": _ts(r.get("min_date")),
        "max_date": _ts(r.get("max_date")),
        "total_calls": _safe_int(r.get("total")),
    }


# ── main endpoint ────────────────────────────────────────────────────────────


@router.get("/api/pipeline-live")
def get_pipeline_live():
    """Return live Snowflake object metadata organized by pipeline tier."""
    try:
        raw_counts = _get_raw_table_counts()
        iceberg_freshness = _get_iceberg_freshness()
        dynamic_tables = _get_dynamic_tables()
        interactive_tables = _get_interactive_tables()
        dt_refresh = _get_dt_refresh_history()
        search_services = _get_cortex_search()
        agents = _get_agents()
        spcs = _get_spcs_status()
        tasks = _get_tasks()
        task_history = _get_task_history()
        call_range = _get_call_date_range()

        # Merge refresh history into DT metadata.
        # For DOWNSTREAM DTs with no refresh history entry, fall back to
        # the data_timestamp from SHOW DYNAMIC TABLES.
        refresh_map = {(r["schema"], r["name"]): r for r in dt_refresh}
        dt_ts_map = _get_dynamic_table_data_timestamps()
        for dt in dynamic_tables:
            key = (dt["schema"], dt["name"])
            refresh = refresh_map.get(key, {})
            dt["last_refresh"] = refresh.get("last_refresh") or dt_ts_map.get(key)
            dt["refresh_duration_secs"] = refresh.get("duration_secs")
            dt["rows_inserted"] = refresh.get("rows_inserted")

        # Analytics DTs only (COACHING is served by Interactive Tables)
        analytics_dts = [dt for dt in dynamic_tables if dt["schema"] == "ANALYTICS"]

        # Merge refresh history into Interactive Tables too
        for it in interactive_tables:
            key = (it["schema"], it["name"])
            refresh = refresh_map.get(key, {})
            it["last_refresh"] = refresh.get("last_refresh")
            it["refresh_duration_secs"] = refresh.get("duration_secs")
            it["rows_inserted"] = refresh.get("rows_inserted")

        # Split raw tables into Iceberg vs reference for display
        iceberg_tables = [r for r in raw_counts if r.get("is_iceberg")]
        ref_tables = [r for r in raw_counts if not r.get("is_iceberg")]
        iceberg_count = len(iceberg_tables)

        return {
            "tiers": {
                "source": {
                    "label": "Source Layer",
                    "description": "Snowflake-Managed Iceberg Tables",
                    "feature": "Snowflake-Managed Iceberg",
                    "objects": [
                        {"name": "Iceberg Tables", "type": "iceberg", "description": "Snowflake-managed open table format (no external storage)", "tables": iceberg_count, "last_refresh": iceberg_freshness},
                    ],
                },
                "raw": {
                    "label": "Raw Layer",
                    "description": "Iceberg + reference tables in Snowflake",
                    "feature": "Iceberg Tables + Snowflake Tables",
                    "objects": [
                        {
                            "name": r["name"],
                            "type": "iceberg" if r.get("is_iceberg") else "table",
                            "rows": _safe_int(r["cnt"]),
                            "last_refresh": _ts(r.get("last_refreshed")),
                        }
                        for r in raw_counts
                    ],
                },
                "analytics": {
                    "label": "Analytics Layer",
                    "description": "Auto-refreshing aggregations — no ETL scheduling",
                    "feature": "Dynamic Tables",
                    "objects": analytics_dts,
                },
                "coaching": {
                    "label": "Coaching Layer",
                    "description": "Low-latency serving + AI",
                    "feature": "Interactive Tables + Cortex AI",
                    "objects": {
                        "interactive_tables": interactive_tables,
                        "search_services": search_services,
                        "agents": agents,
                    },
                },
                "app": {
                    "label": "Application Layer",
                    "description": "Full-stack app on Snowflake compute",
                    "feature": "SPCS",
                    "containers": spcs,
                },
            },
            "tasks": {
                "definitions": tasks,
                "history": task_history,
            },
            "data_range": call_range,
        }
    except Exception:
        logger.exception("Failed to fetch pipeline metadata")
        return {"error": "Failed to fetch pipeline metadata", "tiers": {}, "tasks": {}, "data_range": {}}


# ── keep legacy endpoint working ─────────────────────────────────────────────


@router.get("/api/pipeline-status")
def get_pipeline_status():
    """Legacy endpoint — returns data from RAW.PIPELINE_STATUS for backwards compat."""
    sql = """
        SELECT pipeline_id, pipeline_name, status, description,
               last_run_at, next_run_at, records_processed, error_message, created_at
        FROM BDC_DEMO.RAW.PIPELINE_STATUS
        ORDER BY pipeline_name ASC
    """
    try:
        rows = _query_raw(sql)
    except Exception:
        rows = fetch_all(sql)

    pipelines = []
    for row in rows:
        pipelines.append({
            "pipeline_id": row.get("pipeline_id"),
            "pipeline_name": row.get("pipeline_name"),
            "status": row.get("status"),
            "description": row.get("description"),
            "last_run_at": _ts(row.get("last_run_at")),
            "next_run_at": _ts(row.get("next_run_at")),
            "records_processed": row.get("records_processed"),
            "error_message": row.get("error_message"),
            "created_at": _ts(row.get("created_at")),
        })
    return {"pipelines": pipelines}


# ── run task on demand ───────────────────────────────────────────────────────


@router.post("/api/pipeline/run-task")
def run_task():
    """Execute the daily call generator task on demand."""
    try:
        _query_raw("EXECUTE TASK BDC_DEMO.RAW.DAILY_CALL_GENERATOR")
        return {"status": "ok", "message": "Task triggered successfully"}
    except Exception as e:
        logger.exception("Failed to execute task")
        return {"status": "error", "message": str(e)}
