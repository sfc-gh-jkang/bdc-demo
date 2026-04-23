from typing import Optional

from fastapi import APIRouter, Query

from app.db import fetch_all

router = APIRouter()


@router.get("/api/dashboard")
def get_dashboard(
    dealer_id: Optional[str] = Query(None),
):
    # DASHBOARD_METRICS is aggregated per-dealer — no date dimension.
    sql = """
        SELECT
            dealer_id,
            dealer_name,
            brand,
            total_calls,
            active_agents,
            avg_call_duration,
            appointments_set,
            conversion_rate,
            avg_sentiment,
            avg_call_score,
            unique_customers,
            total_talk_time_seconds
        FROM BDC_DEMO.COACHING.DASHBOARD_METRICS
        WHERE (%(dealer_id)s IS NULL OR dealer_id = %(dealer_id)s)
        ORDER BY total_calls DESC
    """
    rows = fetch_all(sql, {"dealer_id": dealer_id}, interactive=True)

    dealers = []
    for row in rows:
        dealers.append({
            "dealer_id": row.get("dealer_id"),
            "dealer_name": row.get("dealer_name"),
            "brand": row.get("brand"),
            "total_calls": row.get("total_calls"),
            "active_agents": row.get("active_agents"),
            "avg_call_duration": float(row["avg_call_duration"]) if row.get("avg_call_duration") is not None else None,
            "appointments_set": row.get("appointments_set"),
            "conversion_rate": float(row["conversion_rate"]) if row.get("conversion_rate") is not None else None,
            "avg_sentiment": float(row["avg_sentiment"]) if row.get("avg_sentiment") is not None else None,
            "avg_call_score": float(row["avg_call_score"]) if row.get("avg_call_score") is not None else None,
            "unique_customers": row.get("unique_customers"),
            "total_talk_time_seconds": row.get("total_talk_time_seconds"),
        })

    # Aggregate KPIs across all matching dealers
    total_calls = sum(d["total_calls"] or 0 for d in dealers)
    total_appointments = sum(d["appointments_set"] or 0 for d in dealers)
    sentiment_vals = [d["avg_sentiment"] for d in dealers if d["avg_sentiment"] is not None]
    score_vals = [d["avg_call_score"] for d in dealers if d["avg_call_score"] is not None]
    conversion_vals = [d["conversion_rate"] for d in dealers if d["conversion_rate"] is not None]

    return {
        "kpis": {
            "total_calls": total_calls,
            "appointments_set": total_appointments,
            "avg_sentiment": sum(sentiment_vals) / len(sentiment_vals) if sentiment_vals else None,
            "avg_call_score": sum(score_vals) / len(score_vals) if score_vals else None,
            "conversion_rate": sum(conversion_vals) / len(conversion_vals) if conversion_vals else None,
        },
        "dealers": dealers,
    }
