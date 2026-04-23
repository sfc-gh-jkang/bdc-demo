import json
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.db import fetch_all, fetch_one

router = APIRouter()


@router.get("/api/calls")
def list_calls(
    agent_id: Optional[str] = Query(None),
    dealer_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    disposition: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    sql = """
        SELECT
            call_id,
            agent_id,
            agent_name,
            dealer_id,
            dealer_name,
            call_date,
            duration_seconds,
            disposition,
            sentiment_score,
            sentiment_label,
            call_type,
            direction
        FROM BDC_DEMO.COACHING.CALL_DETAILS
        WHERE (%(agent_id)s IS NULL OR agent_id = %(agent_id)s)
          AND (%(dealer_id)s IS NULL OR dealer_id = %(dealer_id)s)
          AND (%(date_from)s IS NULL OR call_date >= %(date_from)s::DATE)
          AND (%(date_to)s IS NULL OR call_date <= %(date_to)s::DATE)
          AND (%(disposition)s IS NULL OR disposition = %(disposition)s)
        ORDER BY call_date DESC
        LIMIT %(limit)s OFFSET %(offset)s
    """
    rows = fetch_all(sql, {
        "agent_id": agent_id,
        "dealer_id": dealer_id,
        "date_from": date_from,
        "date_to": date_to,
        "disposition": disposition,
        "limit": limit,
        "offset": offset,
    }, interactive=True)

    calls = []
    for row in rows:
        cd = row.get("call_date")
        calls.append({
            "call_id": row.get("call_id"),
            "agent_id": row.get("agent_id"),
            "agent_name": row.get("agent_name"),
            "dealer_id": row.get("dealer_id"),
            "dealer_name": row.get("dealer_name"),
            "call_date": cd.isoformat() if isinstance(cd, (date, datetime)) else str(cd) if cd else None,
            "duration_seconds": row.get("duration_seconds"),
            "disposition": row.get("disposition"),
            "sentiment_score": float(row["sentiment_score"]) if row.get("sentiment_score") is not None else None,
            "sentiment_label": row.get("sentiment_label"),
            "call_type": row.get("call_type"),
            "direction": row.get("direction"),
        })

    return {"calls": calls, "limit": limit, "offset": offset}


@router.get("/api/calls/{call_id}")
def get_call(call_id: str):
    sql = """
        SELECT
            call_id,
            agent_id,
            agent_name,
            dealer_id,
            dealer_name,
            call_date,
            call_datetime,
            duration_seconds,
            disposition,
            disposition_class,
            direction,
            call_type,
            skill_tier,
            customer_id,
            customer_name,
            sentiment_score,
            sentiment_label,
            call_summary,
            follow_up_action,
            customer_objections,
            greeting,
            active_listening,
            objection_handling,
            product_knowledge,
            closing,
            professionalism,
            overall_score,
            transcript_json,
            word_count
        FROM BDC_DEMO.COACHING.CALL_DETAILS
        WHERE call_id = %(call_id)s
    """
    row = fetch_one(sql, {"call_id": call_id}, interactive=True)

    if row is None:
        raise HTTPException(status_code=404, detail="Call not found")

    cd = row.get("call_date")
    cdt = row.get("call_datetime")

    # Parse transcript_json — stored as a JSON string of turns
    raw_transcript = row.get("transcript_json")
    if isinstance(raw_transcript, str):
        try:
            transcript_turns = json.loads(raw_transcript)
        except (json.JSONDecodeError, TypeError):
            transcript_turns = []
    elif isinstance(raw_transcript, list):
        transcript_turns = raw_transcript
    else:
        transcript_turns = []

    return {
        "call_id": row.get("call_id"),
        "agent_id": row.get("agent_id"),
        "agent_name": row.get("agent_name"),
        "dealer_id": row.get("dealer_id"),
        "dealer_name": row.get("dealer_name"),
        "call_date": cd.isoformat() if isinstance(cd, (date, datetime)) else str(cd) if cd else None,
        "call_datetime": cdt.isoformat() if isinstance(cdt, datetime) else str(cdt) if cdt else None,
        "duration_seconds": row.get("duration_seconds"),
        "disposition": row.get("disposition"),
        "disposition_class": row.get("disposition_class"),
        "direction": row.get("direction"),
        "call_type": row.get("call_type"),
        "skill_tier": row.get("skill_tier"),
        "customer_id": row.get("customer_id"),
        "customer_name": row.get("customer_name"),
        "sentiment_score": float(row["sentiment_score"]) if row.get("sentiment_score") is not None else None,
        "sentiment_label": row.get("sentiment_label"),
        "call_summary": row.get("call_summary"),
        "follow_up_action": row.get("follow_up_action"),
        "customer_objections": row.get("customer_objections"),
        "scores": {
            "greeting": row.get("greeting"),
            "active_listening": row.get("active_listening"),
            "objection_handling": row.get("objection_handling"),
            "product_knowledge": row.get("product_knowledge"),
            "closing": row.get("closing"),
            "professionalism": row.get("professionalism"),
            "overall_score": row.get("overall_score"),
        },
        "word_count": row.get("word_count"),
        "transcript": transcript_turns,
    }
