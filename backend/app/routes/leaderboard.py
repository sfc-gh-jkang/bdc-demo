from typing import Optional

from fastapi import APIRouter, Query

from app.db import fetch_all

router = APIRouter()

_VALID_SORT_COLS = {
    "composite_score", "avg_score", "avg_sentiment",
    "avg_duration", "total_calls", "appointments_set", "rank",
}


@router.get("/api/leaderboard")
def get_leaderboard(
    dealer_id: Optional[str] = Query(None),
    sort_by: str = Query("composite_score"),
):
    # Whitelist sort column to prevent injection
    col = sort_by if sort_by in _VALID_SORT_COLS else "composite_score"

    sql = f"""
        SELECT
            rank,
            agent_id,
            agent_name,
            dealer_name,
            dealer_id,
            skill_tier,
            total_calls,
            appointments_set,
            avg_score,
            avg_sentiment,
            avg_duration,
            composite_score
        FROM BDC_DEMO.COACHING.AGENT_LEADERBOARD
        WHERE (%(dealer_id)s IS NULL OR dealer_id = %(dealer_id)s)
        ORDER BY {col} DESC
    """
    rows = fetch_all(sql, {"dealer_id": dealer_id}, interactive=True)

    agents = []
    for row in rows:
        agents.append({
            "rank": row.get("rank"),
            "agent_id": row.get("agent_id"),
            "agent_name": row.get("agent_name"),
            "dealer_name": row.get("dealer_name"),
            "dealer_id": row.get("dealer_id"),
            "skill_tier": row.get("skill_tier"),
            "total_calls": row.get("total_calls"),
            "appointments_set": row.get("appointments_set"),
            "avg_score": float(row["avg_score"]) if row.get("avg_score") is not None else None,
            "avg_sentiment": float(row["avg_sentiment"]) if row.get("avg_sentiment") is not None else None,
            "avg_duration": float(row["avg_duration"]) if row.get("avg_duration") is not None else None,
            "composite_score": float(row["composite_score"]) if row.get("composite_score") is not None else None,
        })

    return {"agents": agents}
