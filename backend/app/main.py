from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import close_pool, fetch_one, init_pool
from app.routes import agents, analyst, calls, coaching, dashboard, leaderboard, pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool()
    yield
    close_pool()


app = FastAPI(title="BDC Agent Coaching API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(leaderboard.router)
app.include_router(agents.router)
app.include_router(calls.router)
app.include_router(coaching.router)
app.include_router(pipeline.router)
app.include_router(analyst.router)


@app.get("/health")
def health():
    try:
        row = fetch_one("SELECT CURRENT_WAREHOUSE() AS wh, CURRENT_DATABASE() AS db")
        return {"status": "ok", "warehouse": row.get("wh") if row else None, "database": row.get("db") if row else None}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
