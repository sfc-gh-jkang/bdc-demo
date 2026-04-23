from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.db import fetch_all, fetch_one

router = APIRouter()


@router.get("/api/agents")
def list_agents(dealer_id: Optional[str] = Query(None)):
    sql = """
        SELECT
            agent_id,
            agent_name,
            dealer_id,
            dealer_name,
            skill_tier,
            total_calls,
            appointments_set,
            avg_score,
            avg_sentiment,
            avg_duration,
            composite_score,
            rank
        FROM BDC_DEMO.COACHING.AGENT_LEADERBOARD
        WHERE (%(dealer_id)s IS NULL OR dealer_id = %(dealer_id)s)
        ORDER BY agent_name ASC
    """
    rows = fetch_all(sql, {"dealer_id": dealer_id}, interactive=True)

    agents = []
    for row in rows:
        agents.append({
            "agent_id": row.get("agent_id"),
            "agent_name": row.get("agent_name"),
            "dealer_id": row.get("dealer_id"),
            "dealer_name": row.get("dealer_name"),
            "skill_tier": row.get("skill_tier"),
            "total_calls": row.get("total_calls"),
            "appointments_set": row.get("appointments_set"),
            "avg_score": float(row["avg_score"]) if row.get("avg_score") is not None else None,
            "avg_sentiment": float(row["avg_sentiment"]) if row.get("avg_sentiment") is not None else None,
            "avg_duration": float(row["avg_duration"]) if row.get("avg_duration") is not None else None,
            "composite_score": float(row["composite_score"]) if row.get("composite_score") is not None else None,
            "rank": row.get("rank"),
        })

    return {"agents": agents}


@router.get("/api/agents/{agent_id}")
def get_agent(agent_id: str):
    agent_sql = """
        SELECT
            agent_id,
            agent_name,
            dealer_id,
            dealer_name,
            skill_tier,
            total_calls,
            appointments_set,
            avg_score,
            avg_sentiment,
            avg_duration,
            composite_score,
            rank
        FROM BDC_DEMO.COACHING.AGENT_LEADERBOARD
        WHERE agent_id = %(agent_id)s
    """
    agent = fetch_one(agent_sql, {"agent_id": agent_id}, interactive=True)

    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    calls_sql = """
        SELECT
            call_id,
            call_date,
            duration_seconds,
            disposition,
            sentiment_score,
            sentiment_label,
            overall_score
        FROM BDC_DEMO.COACHING.CALL_DETAILS
        WHERE agent_id = %(agent_id)s
        ORDER BY call_date DESC
        LIMIT 10
    """
    recent_rows = fetch_all(calls_sql, {"agent_id": agent_id}, interactive=True)

    recent_calls = []
    for row in recent_rows:
        cd = row.get("call_date")
        recent_calls.append({
            "call_id": row.get("call_id"),
            "call_date": cd.isoformat() if isinstance(cd, date) else str(cd) if cd else None,
            "duration_seconds": row.get("duration_seconds"),
            "disposition": row.get("disposition"),
            "sentiment_score": float(row["sentiment_score"]) if row.get("sentiment_score") is not None else None,
            "sentiment_label": row.get("sentiment_label"),
            "overall_score": row.get("overall_score"),
        })

    return {
        "agent_id": agent.get("agent_id"),
        "agent_name": agent.get("agent_name"),
        "dealer_id": agent.get("dealer_id"),
        "dealer_name": agent.get("dealer_name"),
        "skill_tier": agent.get("skill_tier"),
        "metrics": {
            "total_calls": agent.get("total_calls"),
            "appointments_set": agent.get("appointments_set"),
            "avg_score": float(agent["avg_score"]) if agent.get("avg_score") is not None else None,
            "avg_sentiment": float(agent["avg_sentiment"]) if agent.get("avg_sentiment") is not None else None,
            "avg_duration": float(agent["avg_duration"]) if agent.get("avg_duration") is not None else None,
            "composite_score": float(agent["composite_score"]) if agent.get("composite_score") is not None else None,
            "rank": agent.get("rank"),
        },
        "recent_calls": recent_calls,
    }
