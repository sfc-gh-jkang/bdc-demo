# ---------------------------------------------------------------------------
# Data sources — workspace + O4S-created datasets
# ---------------------------------------------------------------------------

data "observe_workspace" "default" {
  name = var.workspace_id
}

# ---------------------------------------------------------------------------
# O4S Snowflake datasets — auto-created by the Snowflake app in Observe.
# NOTE: Dataset names use lowercase "snowflake/" prefix, NOT "Snowflake/".
# Column names in all O4S datasets are ALL UPPERCASE.
# ---------------------------------------------------------------------------

data "observe_dataset" "spcs_history" {
  workspace = data.observe_workspace.default.oid
  name      = "snowflake/SNOWPARK_CONTAINER_SERVICES_HISTORY"
}

data "observe_dataset" "query_history" {
  workspace = data.observe_workspace.default.oid
  name      = "snowflake/QUERY_HISTORY"
}
