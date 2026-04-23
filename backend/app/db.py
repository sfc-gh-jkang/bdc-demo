"""Snowflake connection manager for BDC demo.

In SPCS: reads OAuth token from /snowflake/session/token.
Locally: uses connection_name='default' from ~/.snowflake/config.toml.
Production VM: uses key-pair auth via SNOWFLAKE_PRIVATE_KEY_PATH env var.

Uses a connection pool (queue-based) to avoid the ~2-3s TLS+auth overhead
of creating a new connection per query (especially costly on SPCS).
Concurrent requests each get their own connection from the pool.
"""

import hashlib
import json
import logging
import os
import queue
import threading
import time
from contextlib import contextmanager
from pathlib import Path

import snowflake.connector
from cryptography.hazmat.primitives import serialization

logger = logging.getLogger(__name__)

_DATABASE = os.environ.get("SNOWFLAKE_DATABASE", "BDC_DEMO")
_SCHEMA = os.environ.get("SNOWFLAKE_SCHEMA", "COACHING")
_WAREHOUSE = os.environ.get("SNOWFLAKE_WAREHOUSE", "BDC_STD_WH")
_INTERACTIVE_WH = os.environ.get("SNOWFLAKE_INTERACTIVE_WAREHOUSE", "BDC_INTERACTIVE_WH")

# ---------- simple TTL cache ----------

_CACHE_TTL = int(os.environ.get("QUERY_CACHE_TTL_SECONDS", "300"))
_cache: dict[str, tuple[float, object]] = {}
_cache_lock = threading.Lock()


def _cache_key(sql: str, params: dict | None) -> str:
    raw = sql + json.dumps(params or {}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_get(key: str) -> object | None:
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        ts, value = entry
        if time.monotonic() - ts > _CACHE_TTL:
            del _cache[key]
            return None
        return value


def _cache_set(key: str, value: object) -> None:
    with _cache_lock:
        _cache[key] = (time.monotonic(), value)
        # Evict expired entries if cache grows large
        if len(_cache) > 500:
            now = time.monotonic()
            expired = [k for k, (ts, _) in _cache.items() if now - ts > _CACHE_TTL]
            for k in expired:
                del _cache[k]


def _load_private_key(path: str) -> bytes:
    """Load a PKCS8 PEM private key and return DER bytes for the connector."""
    with open(path, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)
    return private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )


# ---------- connection pool ----------

_POOL_SIZE = int(os.environ.get("SNOWFLAKE_POOL_SIZE", "4"))
_ALIVE_SKIP_SECONDS = 60  # skip SELECT 1 if connection was used within this window


class _PoolEntry:
    """Wraps a connection with a last-used timestamp for smart liveness checks."""
    __slots__ = ("conn", "last_used")

    def __init__(self, conn: snowflake.connector.SnowflakeConnection):
        self.conn = conn
        self.last_used = time.monotonic()

    def touch(self) -> None:
        self.last_used = time.monotonic()


_pool: queue.Queue[_PoolEntry] = queue.Queue(maxsize=_POOL_SIZE)
_pool_initialized = False
_pool_lock = threading.Lock()


def _create_connection() -> snowflake.connector.SnowflakeConnection:
    token_path = Path("/snowflake/session/token")
    private_key_path = os.environ.get("SNOWFLAKE_PRIVATE_KEY_PATH")

    if token_path.exists():
        # Running inside SPCS — use OAuth token
        token = token_path.read_text().strip()
        return snowflake.connector.connect(
            host=os.environ["SNOWFLAKE_HOST"],
            account=os.environ["SNOWFLAKE_ACCOUNT"],
            token=token,
            authenticator="oauth",
            warehouse=_WAREHOUSE,
            database=_DATABASE,
            schema=_SCHEMA,
        )
    elif private_key_path:
        # Production VM — key-pair auth with service user
        return snowflake.connector.connect(
            account=os.environ.get("SNOWFLAKE_ACCOUNT", ""),
            user=os.environ.get("SNOWFLAKE_USER", ""),
            private_key=_load_private_key(private_key_path),
            role=os.environ.get("SNOWFLAKE_ROLE", ""),
            warehouse=_WAREHOUSE,
            database=_DATABASE,
            schema=_SCHEMA,
        )
    else:
        # Local development — use config.toml connection
        conn_name = os.environ.get("SNOWFLAKE_CONNECTION_NAME", "default")
        return snowflake.connector.connect(
            connection_name=conn_name,
            database=_DATABASE,
            schema=_SCHEMA,
            warehouse=_WAREHOUSE,
        )


def init_pool() -> None:
    """Public entry point to pre-warm the connection pool at app startup."""
    _init_pool()


def _init_pool() -> None:
    """Pre-create all pool connections on first use."""
    global _pool_initialized
    with _pool_lock:
        if _pool_initialized:
            return
        logger.info("Initializing Snowflake connection pool (size=%d)", _POOL_SIZE)
        for i in range(_POOL_SIZE):
            try:
                conn = _create_connection()
                _pool.put_nowait(_PoolEntry(conn))
                logger.info("Pool connection %d/%d created", i + 1, _POOL_SIZE)
            except Exception:
                logger.exception("Failed to create pool connection %d", i + 1)
        _pool_initialized = True


def _is_alive(conn: snowflake.connector.SnowflakeConnection) -> bool:
    """Quick liveness check without opening a cursor if possible."""
    try:
        conn.cursor().execute("SELECT 1").close()
        return True
    except Exception:
        return False


@contextmanager
def get_connection():
    """Check out a connection from the pool; return it when done."""
    _init_pool()
    entry: _PoolEntry | None = None
    try:
        entry = _pool.get(timeout=30)
        # Skip liveness check if connection was used recently
        if time.monotonic() - entry.last_used > _ALIVE_SKIP_SECONDS:
            if not _is_alive(entry.conn):
                logger.warning("Pool connection stale, replacing")
                try:
                    entry.conn.close()
                except Exception:
                    pass
                entry = _PoolEntry(_create_connection())
        yield entry.conn
        entry.touch()
    except Exception:
        # Connection may be broken — discard and create fresh for pool
        if entry is not None:
            try:
                entry.conn.close()
            except Exception:
                pass
            entry = _PoolEntry(_create_connection())
        raise
    finally:
        if entry is not None:
            try:
                _pool.put_nowait(entry)
            except queue.Full:
                entry.conn.close()


def close_pool() -> None:
    """Drain and close all pool connections (call on app shutdown)."""
    global _pool_initialized
    closed = 0
    while True:
        try:
            entry = _pool.get_nowait()
            try:
                entry.conn.close()
            except Exception:
                pass
            closed += 1
        except queue.Empty:
            break
    _pool_initialized = False
    logger.info("Closed %d pool connections", closed)


def fetch_all(sql: str, params: dict | None = None, *, interactive: bool = False) -> list[dict]:
    """Execute SQL and return all rows as list of dicts (cached for TTL seconds).

    When interactive=True, switches to the Interactive warehouse for the query
    (required for querying Interactive Tables) then switches back.
    """
    key = _cache_key(sql, params)
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]
    with get_connection() as conn:
        cur = conn.cursor(snowflake.connector.DictCursor)
        try:
            if interactive:
                cur.execute(f"USE WAREHOUSE {_INTERACTIVE_WH}")
            cur.execute(sql, params or {})
            rows = cur.fetchall()
            # Snowflake DictCursor returns UPPER_CASE keys — convert to lower
            result = [{k.lower(): v for k, v in row.items()} for row in rows]
            _cache_set(key, result)
            return result
        finally:
            if interactive:
                try:
                    cur.execute(f"USE WAREHOUSE {_WAREHOUSE}")
                except Exception:
                    pass
            cur.close()


def fetch_one(sql: str, params: dict | None = None, *, interactive: bool = False) -> dict | None:
    """Execute SQL and return single row as dict, or None (cached for TTL seconds).

    When interactive=True, switches to the Interactive warehouse for the query.
    """
    key = _cache_key(sql, params)
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]
    with get_connection() as conn:
        cur = conn.cursor(snowflake.connector.DictCursor)
        try:
            if interactive:
                cur.execute(f"USE WAREHOUSE {_INTERACTIVE_WH}")
            cur.execute(sql, params or {})
            row = cur.fetchone()
            if row is None:
                return None
            result = {k.lower(): v for k, v in row.items()}
            _cache_set(key, result)
            return result
        finally:
            if interactive:
                try:
                    cur.execute(f"USE WAREHOUSE {_WAREHOUSE}")
                except Exception:
                    pass
            cur.close()
