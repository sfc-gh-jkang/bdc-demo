# Screenshots

UI captures used in the top-level [README](../../README.md). Resolution: 1440px wide, cropped to app content (sidebar + main panel, no browser chrome).

| # | File | Route | What it shows |
|---|------|-------|---------------|
| 01 | `01-dashboard.png` | `/` | Landing KPIs — total calls, avg coaching score, trend chart, top/bottom agents. All queries hit Interactive Tables (sub-second). |
| 02 | `02-leaderboard.png` | `/leaderboard` | Agent ranking with filters. Entry point for a BDC manager's day — who to coach first. |
| 03 | `03-pipeline.png` | `/pipeline` | Live view of the data pipeline: Iceberg sources → Dynamic Tables → Interactive Tables with row counts and refresh times. |
| 04 | `04-calls-list.png` | `/calls` | Searchable/filterable call log across all 15K synthetic calls. |
| 05 | `05-call-detail.png` | `/calls/:id` | One call — 7 coaching-dimension scores, transcript, and AI analysis panel (sentiment, summary, disposition). All fields generated once at ingest by Cortex Agent. |
| 06 | `06-agent-detail.png` | `/agents/:id` | Per-agent profile — strengths / areas for improvement / action items, streamed from claude-4-sonnet grounded on Cortex Search RAG over the agent's transcripts. |
| 07 | `07-analyst.png` | `/analyst` | Cortex Analyst chat — natural language over the call data (text-to-SQL). No separate BI tool. |

## Recapturing

See `docs/DEMO_SCRIPT.md` for the walkthrough. To recapture:

```bash
# bring the target page to front in your browser, then:
screencapture -x -R<x>,<y>,<w>,<h> docs/screenshots/NN-name.png
sips -Z 1440 docs/screenshots/NN-name.png
```
