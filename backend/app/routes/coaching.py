"""Coaching AI routes — agent summary and interactive chat.

Both endpoints use the Cortex Agent (BDC_DEMO.COACHING.COACHING_AGENT) so it
can leverage the Cortex Search tool for transcript lookups.

NOTE: The Cortex Agent API only allows claude models (claude-4-sonnet, etc).
      llama/mistral models are NOT supported for Agent requests.
      CORTEX.COMPLETE() (SQL function) does support llama — but we don't use it
      here so both summary and chat go through the same Agent with search tools.
"""

import json
import sys
from datetime import date, datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.cortex import is_spcs, run_agent_with_metadata, run_agent_stream_with_metadata
from app.db import fetch_all, fetch_one

router = APIRouter()


def _log(msg: str) -> None:
    print(f"[COACHING] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# GET /api/agents/{agent_id}/summary — AI-generated coaching summary
# ---------------------------------------------------------------------------

@router.get("/api/agents/{agent_id}/summary")
async def agent_summary(agent_id: str):
    """Generate a coaching summary using the Cortex Agent with search tools."""

    # Fetch agent info
    agent = fetch_one(
        "SELECT AGENT_ID, FIRST_NAME || ' ' || LAST_NAME AS AGENT_NAME, SKILL_TIER "
        "FROM BDC_DEMO.RAW.AGENTS WHERE AGENT_ID = %(agent_id)s",
        {"agent_id": agent_id},
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Fetch last 5 calls with scores for context
    calls = fetch_all(
        """
        SELECT
            c.CALL_ID, c.CALL_DATE, c.DISPOSITION, c.DURATION_SECONDS,
            e.SENTIMENT_SCORE, e.CALL_SUMMARY,
            s.GREETING, s.ACTIVE_LISTENING, s.OBJECTION_HANDLING,
            s.PRODUCT_KNOWLEDGE, s.CLOSING, s.PROFESSIONALISM, s.OVERALL_SCORE
        FROM BDC_DEMO.RAW.CALLS c
        LEFT JOIN BDC_DEMO.RAW.CALL_AI_ENRICHMENTS e ON c.CALL_ID = e.CALL_ID
        LEFT JOIN BDC_DEMO.RAW.CALL_SCORES s ON c.CALL_ID = s.CALL_ID
        WHERE c.AGENT_ID = %(agent_id)s
        ORDER BY c.CALL_DATE DESC
        LIMIT 5
        """,
        {"agent_id": agent_id},
    )

    if not calls:
        return {
            "summary": "No recent calls found for this agent.",
            "generated_at": datetime.utcnow().isoformat(),
        }

    # Build context for the Agent
    call_lines = []
    for i, c in enumerate(calls, 1):
        cd = c.get("call_date")
        ds = cd.isoformat() if isinstance(cd, (date, datetime)) else str(cd) if cd else "unknown"
        call_lines.append(
            f"Call {i} ({ds}): disposition={c.get('disposition')}, "
            f"sentiment={c.get('sentiment_score')}, overall={c.get('overall_score')}, "
            f"greeting={c.get('greeting')}, listening={c.get('active_listening')}, "
            f"objections={c.get('objection_handling')}, product={c.get('product_knowledge')}, "
            f"closing={c.get('closing')}, professionalism={c.get('professionalism')}. "
            f"Summary: {c.get('call_summary', 'N/A')}"
        )

    prompt = (
        f"Analyze the last 5 calls for BDC agent {agent.get('agent_name')} "
        f"(ID: {agent_id}, skill tier: {agent.get('skill_tier')}). "
        "Search their call transcripts for additional context.\n\n"
        + "\n".join(call_lines)
        + "\n\nProvide a brief coaching summary with:\n"
        "1. **Strengths** — what this agent does well (2-3 bullets)\n"
        "2. **Areas for Improvement** — specific skills to work on (2-3 bullets)\n"
        "3. **Action Items** — concrete next steps for this week (2-3 bullets)\n\n"
        "Keep it concise and actionable."
    )

    if not is_spcs():
        return {
            "summary": "Cortex Agent is only available when deployed to SPCS.",
            "generated_at": datetime.utcnow().isoformat(),
        }

    _log(f"Generating summary for agent {agent_id}")
    messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]

    async def _sse_generator():
        """Yield SSE events: status, delta, metadata, done."""
        try:
            async for item in run_agent_stream_with_metadata(messages):
                if isinstance(item, dict) and item.get("__status__"):
                    yield f"event: status\ndata: {json.dumps({'message': item['message']})}\n\n"
                elif isinstance(item, dict):
                    meta = {k: v for k, v in item.items() if k != "__metadata__"}
                    _log(f"Summary metadata: {meta}")
                    yield f"event: metadata\ndata: {json.dumps(meta)}\n\n"
                else:
                    yield f"event: delta\ndata: {json.dumps({'text': item})}\n\n"
        except Exception as e:
            _log(f"Summary stream error: {e}")
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


# ---------------------------------------------------------------------------
# POST /api/agents/{agent_id}/chat — streaming chat with Cortex Agent
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/api/agents/{agent_id}/chat")
async def agent_chat(agent_id: str, req: ChatRequest):
    """Chat with the Cortex coaching agent — streams SSE to the browser."""

    # Verify agent exists
    agent = fetch_one(
        "SELECT AGENT_ID, FIRST_NAME || ' ' || LAST_NAME AS AGENT_NAME, SKILL_TIER "
        "FROM BDC_DEMO.RAW.AGENTS WHERE AGENT_ID = %(agent_id)s",
        {"agent_id": agent_id},
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not is_spcs():
        return {"response": "Cortex Agent chat is available when deployed to SPCS."}

    # Build message list for the Cortex Agent
    system_context = (
        f"The user is asking about BDC agent {agent.get('agent_name')} "
        f"(ID: {agent_id}, skill tier: {agent.get('skill_tier')}). "
        "Search their call transcripts to provide data-driven coaching advice."
    )

    messages: list[dict] = []

    # Add conversation history
    for msg in req.history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        messages.append({
            "role": role,
            "content": [{"type": "text", "text": content}],
        })

    # Add current message with agent context
    user_text = f"[Context: {system_context}]\n\n{req.message}"
    messages.append({
        "role": "user",
        "content": [{"type": "text", "text": user_text}],
    })

    _log(f"Chat request for agent {agent_id}, messages={len(messages)}")
    _log(f"User message: {req.message[:150]}")

    async def _sse_generator():
        """Yield SSE events: delta (text), metadata (final), done (terminator)."""
        try:
            async for item in run_agent_stream_with_metadata(messages):
                if isinstance(item, dict) and item.get("__status__"):
                    yield f"event: status\ndata: {json.dumps({'message': item['message']})}\n\n"
                elif isinstance(item, dict):
                    # Final metadata item — strip internal flag
                    meta = {k: v for k, v in item.items() if k != "__metadata__"}
                    yield f"event: metadata\ndata: {json.dumps(meta)}\n\n"
                else:
                    yield f"event: delta\ndata: {json.dumps({'text': item})}\n\n"
        except Exception as e:
            _log(f"Chat stream error: {e}")
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        _sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # nginx hint
        },
    )
