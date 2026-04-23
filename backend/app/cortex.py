"""Cortex Agent REST API helper for SPCS.

Uses the SPCS OAuth token + internal host to call the Cortex Agent :run
endpoint.  Falls back to a placeholder when running locally.

NOTE: The Agent API only allows claude models (claude-4-sonnet, etc).
      llama/mistral are NOT supported — they return event:error.
"""

import json
import os
import sys
import time
from collections.abc import AsyncIterator
from typing import Union
from pathlib import Path

import httpx

_TOKEN_PATH = Path("/snowflake/session/token")

# Agent coordinates
_DB = os.environ.get("SNOWFLAKE_DATABASE", "BDC_DEMO")
_SCHEMA = "COACHING"
_AGENT_NAME = "COACHING_AGENT"


def _log(msg: str) -> None:
    print(f"[CORTEX] {msg}", file=sys.stderr, flush=True)


def _read_token() -> str:
    return _TOKEN_PATH.read_text().strip()


def _base_url() -> str:
    host = os.environ.get("SNOWFLAKE_HOST", "")
    return f"https://{host}"


def is_spcs() -> bool:
    return _TOKEN_PATH.exists()


def _extract_text(payload: dict) -> str:
    """Extract text from any known Cortex Agent SSE payload shape."""
    parts: list[str] = []

    # Shape 1: {"delta": {"content": [{"type": "text", "text": "..."}]}}
    delta = payload.get("delta", {})
    content = delta.get("content", [])
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
    elif isinstance(content, dict):
        # Shape 1b: {"delta": {"content": {"type": "text", "text": "..."}}}
        if content.get("type") == "text":
            parts.append(content.get("text", ""))

    # Shape 2: {"choices": [{"delta": {"content": "..."}}]}
    for choice in payload.get("choices", []):
        d = choice.get("delta", {})
        c = d.get("content")
        if isinstance(c, str):
            parts.append(c)

    # Shape 3: top-level "text" key
    if "text" in payload and isinstance(payload["text"], str):
        parts.append(payload["text"])

    # Shape 4: top-level "content" list (final response)
    top_content = payload.get("content", [])
    if isinstance(top_content, list):
        for item in top_content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))

    return "".join(parts)


async def run_agent_stream(
    messages: list[dict],
) -> AsyncIterator[str]:
    """Call the Cortex Agent :run endpoint and yield text chunks via SSE."""

    if not is_spcs():
        yield "Cortex Agent is only available when running on SPCS."
        return

    url = (
        f"{_base_url()}/api/v2/databases/{_DB}"
        f"/schemas/{_SCHEMA}/agents/{_AGENT_NAME}:run"
    )

    body = {
        "messages": messages,
    }

    headers = {
        "Authorization": f"Bearer {_read_token()}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    _log(f"POST {url}")
    _log(f"Body: {json.dumps(body)[:500]}")

    try:
        async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
            async with client.stream("POST", url, json=body, headers=headers) as resp:
                _log(f"Response status: {resp.status_code}")
                _log(f"Response headers: {dict(resp.headers)}")

                if resp.status_code != 200:
                    error_body = ""
                    async for chunk in resp.aiter_text():
                        error_body += chunk
                    _log(f"Error body: {error_body[:500]}")
                    yield f"Error calling Cortex Agent (HTTP {resp.status_code}): {error_body[:200]}"
                    return

                line_count = 0
                event_type = None
                data_buf: list[str] = []

                async for raw_line in resp.aiter_lines():
                    line = raw_line.strip()
                    line_count += 1

                    # Log first 50 raw lines for debugging
                    if line_count <= 50:
                        _log(f"RAW[{line_count}]: {line[:300]}")

                    if line.startswith("event:"):
                        event_type = line.split("event:", 1)[1].strip()
                        data_buf = []
                    elif line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            _log("Got [DONE]")
                            return
                        data_buf.append(data_str)
                    elif line == "" and data_buf:
                        # End of SSE block
                        raw = "\n".join(data_buf)
                        data_buf = []

                        try:
                            payload = json.loads(raw)
                        except json.JSONDecodeError:
                            _log(f"JSON parse failed: {raw[:200]}")
                            continue

                        if line_count <= 50:
                            _log(f"PARSED event={event_type}: {json.dumps(payload)[:300]}")

                        # Handle error events from the Agent API
                        if event_type == "error":
                            err_msg = payload.get("message", json.dumps(payload)[:300])
                            _log(f"AGENT ERROR: {err_msg}")
                            yield f"[Agent error: {err_msg}]"
                            return

                        # Only extract text from actual content events.
                        # Skip thinking, status, tool, and final response events.
                        if event_type in (
                            "response.thinking.delta",
                            "response.thinking",
                            "response.status",
                            "response.tool_use",
                            "response.tool_result",
                            "response.tool_result.status",
                            "response",
                            "response.text",
                        ):
                            continue

                        text = _extract_text(payload)
                        if text:
                            _log(f"EXTRACTED (event={event_type}): {text[:100]}")
                            yield text

                _log(f"Stream ended. Total lines: {line_count}")

    except httpx.TimeoutException:
        _log("Request timed out")
        yield "\n\n[Request timed out after 120 seconds]"
    except Exception as e:
        _log(f"Exception: {e}")
        yield f"\n\n[Error: {e}]"


async def run_agent_stream_with_metadata(
    messages: list[dict],
) -> AsyncIterator[Union[str, dict]]:
    """Stream text chunks from the Agent, then yield metadata as the final item.

    Yields:
        str — text chunks as they arrive
        dict — final item: {"__metadata__": True, "model": ..., "latency_ms": ..., ...}
    """
    if not is_spcs():
        yield "Cortex Agent is only available when running on SPCS."
        return

    url = (
        f"{_base_url()}/api/v2/databases/{_DB}"
        f"/schemas/{_SCHEMA}/agents/{_AGENT_NAME}:run"
    )
    body = {"messages": messages}
    headers = {
        "Authorization": f"Bearer {_read_token()}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    _log(f"POST {url}")
    metadata: dict = {"__metadata__": True}
    start = time.monotonic()

    try:
        async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
            async with client.stream("POST", url, json=body, headers=headers) as resp:
                _log(f"Response status: {resp.status_code}")
                metadata["request_id"] = resp.headers.get("x-snowflake-request-id")

                if resp.status_code != 200:
                    error_body = ""
                    async for chunk in resp.aiter_text():
                        error_body += chunk
                    _log(f"Error body: {error_body[:500]}")
                    yield f"Error calling Cortex Agent (HTTP {resp.status_code}): {error_body[:200]}"
                    metadata["latency_ms"] = int((time.monotonic() - start) * 1000)
                    yield metadata
                    return

                line_count = 0
                event_type = None
                data_buf: list[str] = []

                async for raw_line in resp.aiter_lines():
                    line = raw_line.strip()
                    line_count += 1

                    if line_count <= 50:
                        _log(f"RAW[{line_count}]: {line[:300]}")

                    if line.startswith("event:"):
                        event_type = line.split("event:", 1)[1].strip()
                        data_buf = []
                    elif line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            _log("Got [DONE]")
                            break
                        data_buf.append(data_str)
                    elif line == "" and data_buf:
                        raw = "\n".join(data_buf)
                        data_buf = []

                        try:
                            payload = json.loads(raw)
                        except json.JSONDecodeError:
                            _log(f"JSON parse failed: {raw[:200]}")
                            continue

                        # Handle error events
                        if event_type == "error":
                            err_msg = payload.get("message", json.dumps(payload)[:300])
                            _log(f"AGENT ERROR: {err_msg}")
                            yield f"[Agent error: {err_msg}]"
                            metadata["latency_ms"] = int((time.monotonic() - start) * 1000)
                            yield metadata
                            return

                        # Capture metadata from final response event
                        if event_type == "response":
                            resp_meta = payload.get("metadata", {})
                            usage = resp_meta.get("usage", {})
                            tokens_list = usage.get("tokens_consumed", [])
                            if tokens_list:
                                t = tokens_list[0]
                                metadata["model"] = t.get("model_name")
                                inp = t.get("input_tokens", {})
                                metadata["input_tokens"] = inp.get("total")
                                metadata["cache_read_tokens"] = inp.get("cache_read")
                                out = t.get("output_tokens", {})
                                metadata["output_tokens"] = out.get("total")
                            metadata["run_id"] = resp_meta.get("run_id")
                            _log(f"METADATA: {metadata}")
                            continue

                        # Skip thinking events silently
                        if event_type in (
                            "response.thinking.delta",
                            "response.thinking",
                            "response.text",
                        ):
                            continue

                        # Forward tool/status events so the UI can show progress
                        if event_type == "response.status":
                            status_msg = payload.get("status", "")
                            if status_msg:
                                yield {"__status__": True, "message": status_msg}
                            continue
                        if event_type == "response.tool_use":
                            tool_name = payload.get("name", payload.get("tool", ""))
                            if tool_name:
                                yield {"__status__": True, "message": f"Using tool: {tool_name}"}
                            continue
                        if event_type in (
                            "response.tool_result",
                            "response.tool_result.status",
                        ):
                            continue

                        text = _extract_text(payload)
                        if text:
                            yield text

                _log(f"Stream ended. Total lines: {line_count}")

    except httpx.TimeoutException:
        _log("Request timed out")
        yield "\n\n[Request timed out after 120 seconds]"
    except Exception as e:
        _log(f"Exception: {e}")
        yield f"\n\n[Error: {e}]"

    metadata["latency_ms"] = int((time.monotonic() - start) * 1000)
    yield metadata


async def run_agent_with_metadata(messages: list[dict]) -> dict:
    """Call the agent, collect text + metadata from the response event.

    Returns:
        {
            "text": str,
            "metadata": {
                "model": str | None,
                "input_tokens": int | None,
                "output_tokens": int | None,
                "cache_read_tokens": int | None,
                "latency_ms": int,
                "request_id": str | None,
                "run_id": str | None,
            }
        }
    """
    if not is_spcs():
        return {"text": "Cortex Agent is only available when running on SPCS.", "metadata": {}}

    url = (
        f"{_base_url()}/api/v2/databases/{_DB}"
        f"/schemas/{_SCHEMA}/agents/{_AGENT_NAME}:run"
    )
    body = {"messages": messages}
    headers = {
        "Authorization": f"Bearer {_read_token()}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    _log(f"POST {url}")
    _log(f"Body: {json.dumps(body)[:500]}")

    text_parts: list[str] = []
    metadata: dict = {}
    start = time.monotonic()

    try:
        async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
            async with client.stream("POST", url, json=body, headers=headers) as resp:
                _log(f"Response status: {resp.status_code}")

                request_id = resp.headers.get("x-snowflake-request-id")
                metadata["request_id"] = request_id

                if resp.status_code != 200:
                    error_body = ""
                    async for chunk in resp.aiter_text():
                        error_body += chunk
                    _log(f"Error body: {error_body[:500]}")
                    metadata["latency_ms"] = int((time.monotonic() - start) * 1000)
                    return {
                        "text": f"Error calling Cortex Agent (HTTP {resp.status_code}): {error_body[:200]}",
                        "metadata": metadata,
                    }

                line_count = 0
                event_type = None
                data_buf: list[str] = []

                async for raw_line in resp.aiter_lines():
                    line = raw_line.strip()
                    line_count += 1

                    if line_count <= 50:
                        _log(f"RAW[{line_count}]: {line[:300]}")

                    if line.startswith("event:"):
                        event_type = line.split("event:", 1)[1].strip()
                        data_buf = []
                    elif line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            _log("Got [DONE]")
                            break
                        data_buf.append(data_str)
                    elif line == "" and data_buf:
                        raw = "\n".join(data_buf)
                        data_buf = []

                        try:
                            payload = json.loads(raw)
                        except json.JSONDecodeError:
                            _log(f"JSON parse failed: {raw[:200]}")
                            continue

                        if line_count <= 50:
                            _log(f"PARSED event={event_type}: {json.dumps(payload)[:300]}")

                        # Handle error events
                        if event_type == "error":
                            err_msg = payload.get("message", json.dumps(payload)[:300])
                            _log(f"AGENT ERROR: {err_msg}")
                            metadata["latency_ms"] = int((time.monotonic() - start) * 1000)
                            return {"text": f"[Agent error: {err_msg}]", "metadata": metadata}

                        # Capture metadata from the final `response` event
                        if event_type == "response":
                            resp_meta = payload.get("metadata", {})
                            usage = resp_meta.get("usage", {})
                            tokens_list = usage.get("tokens_consumed", [])
                            if tokens_list:
                                t = tokens_list[0]
                                metadata["model"] = t.get("model_name")
                                inp = t.get("input_tokens", {})
                                metadata["input_tokens"] = inp.get("total")
                                metadata["cache_read_tokens"] = inp.get("cache_read")
                                out = t.get("output_tokens", {})
                                metadata["output_tokens"] = out.get("total")
                            metadata["run_id"] = resp_meta.get("run_id")
                            _log(f"METADATA: {metadata}")
                            continue

                        # Skip thinking, status, tool events — only extract actual content.
                        if event_type in (
                            "response.thinking.delta",
                            "response.thinking",
                            "response.status",
                            "response.tool_use",
                            "response.tool_result",
                            "response.tool_result.status",
                            "response.text",
                        ):
                            continue

                        text = _extract_text(payload)
                        if text:
                            _log(f"EXTRACTED (event={event_type}): {text[:100]}")
                            text_parts.append(text)

                _log(f"Stream ended. Total lines: {line_count}")

    except httpx.TimeoutException:
        _log("Request timed out")
        text_parts.append("\n\n[Request timed out after 120 seconds]")
    except Exception as e:
        _log(f"Exception: {e}")
        text_parts.append(f"\n\n[Error: {e}]")

    metadata["latency_ms"] = int((time.monotonic() - start) * 1000)
    result_text = "".join(text_parts)
    _log(f"run_agent_with_metadata chunks={len(text_parts)} len={len(result_text)}")
    return {"text": result_text, "metadata": metadata}


async def run_agent_sync(messages: list[dict]) -> str:
    """Call the agent and collect the full response as a single string."""
    result = await run_agent_with_metadata(messages)
    return result["text"]
