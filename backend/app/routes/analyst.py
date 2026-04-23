"""Cortex Agent route — natural-language queries over BDC data.

Uses the existing COACHING_AGENT (Cortex Agent) to answer natural-language
questions about calls, agents, dealer performance, etc.  The agent has
access to the BDC_ANALYTICS semantic view and call transcript search.

Streams SSE events to the browser for a real-time typing effect.
"""

import json
import sys

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.cortex import is_spcs, run_agent_stream_with_metadata

router = APIRouter()


def _log(msg: str) -> None:
    print(f"[ANALYST] {msg}", file=sys.stderr, flush=True)


class AnalystQuery(BaseModel):
    question: str


@router.post("/api/analyst/query")
async def analyst_query(req: AnalystQuery):
    """Stream an SSE response from the Cortex Agent for a NL analytics question."""

    if not is_spcs():
        # Non-SPCS fallback: return a single JSON response
        return {
            "answer": "Cortex Agent is only available when deployed to SPCS.",
            "sql": None,
            "results": [],
            "columns": [],
        }

    _log(f"Query: {req.question}")

    prompt = (
        "You are a BDC analytics assistant. Answer the following question about "
        "automotive BDC (Business Development Center) data using the tools available "
        "to you. Use the semantic view to write and execute SQL when needed. "
        "Be concise and data-driven in your response.\n\n"
        f"Question: {req.question}"
    )

    messages = [
        {"role": "user", "content": [{"type": "text", "text": prompt}]}
    ]

    async def _sse_generator():
        """Yield SSE events: delta (text chunks), metadata (final), done."""
        try:
            async for item in run_agent_stream_with_metadata(messages):
                if isinstance(item, dict) and item.get("__status__"):
                    yield f"event: status\ndata: {json.dumps({'message': item['message']})}\n\n"
                elif isinstance(item, dict):
                    # Final metadata item — strip internal flag
                    meta = {k: v for k, v in item.items() if k != "__metadata__"}
                    _log(f"Metadata: {meta}")
                    yield f"event: metadata\ndata: {json.dumps(meta)}\n\n"
                else:
                    yield f"event: delta\ndata: {json.dumps({'text': item})}\n\n"
        except Exception as e:
            _log(f"Stream error: {e}")
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        _sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
