variable "workspace_id" {
  description = "Observe workspace name (as shown in the Observe UI)"
  type        = string
}

variable "service_name" {
  description = "SPCS service name used to filter SPCS_HISTORY metrics"
  type        = string
  default     = "BDC_COACHING_SERVICE"
}

variable "database_name" {
  description = "Snowflake database name for the BDC demo"
  type        = string
  default     = "BDC_DEMO"
}
