# ---------------------------------------------------------------------------
# BDC BDC Demo — Observe Dashboards
# ---------------------------------------------------------------------------
#
# Three dashboards monitoring the BDC BDC SPCS demo application:
#   1. SPCS Service Health — compute pool credits and container instance status
#   2. Query Performance   — warehouse query latency, volume, and errors
#   3. App Metrics         — endpoint query patterns and timing breakdowns
#
# IMPORTANT NOTES (mirroring prefect-spcs learnings):
#   - O4S dataset columns are ALL UPPERCASE (SERVICE_NAME, CREDITS_USED, etc.)
#   - NEVER use explicit timechart bucket sizes — let Observe auto-bucket
#   - ONLY LineChart type — BarChart causes X/Y field rendering errors
#   - NEVER use case(), percentile(), or isnull() in OPAL pipelines
#   - Warehouse names hardcoded to BDC_INTERACTIVE_WH / BDC_STD_WH
#   - SPCS STATUS and INSTANCE_ID column availability depends on O4S version;
#     stage-bdc-spcs-instance-status may return empty if columns are absent
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 1. BDC SPCS Service Health
#    3 panels: Credits/Hour by Pool, Total Credits/Hour, Instance Count by Status
# ---------------------------------------------------------------------------
resource "observe_dashboard" "bdc_spcs" {
  workspace = data.observe_workspace.default.oid
  name      = "BDC SPCS Service Health"

  stages = templatefile("${path.module}/bdc_spcs_stages.json.tftpl", {
    spcs_dataset = data.observe_dataset.spcs_history.id
    service_name = var.service_name
  })

  layout = file("${path.module}/bdc_spcs_layout.json.tftpl")
}

# ---------------------------------------------------------------------------
# 2. BDC Query Performance
#    4 panels: Avg Latency (avg/max) by Warehouse, Query Count by Warehouse,
#              Error Query Count, Queries by Type
# ---------------------------------------------------------------------------
resource "observe_dashboard" "bdc_query" {
  workspace = data.observe_workspace.default.oid
  name      = "BDC Query Performance"

  stages = templatefile("${path.module}/bdc_query_stages.json.tftpl", {
    query_dataset = data.observe_dataset.query_history.id
  })

  layout = file("${path.module}/bdc_query_layout.json.tftpl")
}

# ---------------------------------------------------------------------------
# 3. BDC App Metrics
#    3 panels: Queries per Endpoint Pattern, Avg Query Duration Trend,
#              Compilation vs Execution Time Breakdown
# ---------------------------------------------------------------------------
resource "observe_dashboard" "bdc_app" {
  workspace = data.observe_workspace.default.oid
  name      = "BDC App Metrics"

  stages = templatefile("${path.module}/bdc_app_stages.json.tftpl", {
    query_dataset = data.observe_dataset.query_history.id
  })

  layout = file("${path.module}/bdc_app_layout.json.tftpl")
}
