output "bdc_spcs_dashboard_id" {
  description = "Observe OID for the BDC SPCS Service Health dashboard"
  value       = observe_dashboard.bdc_spcs.id
}

output "bdc_query_dashboard_id" {
  description = "Observe OID for the BDC Query Performance dashboard"
  value       = observe_dashboard.bdc_query.id
}

output "bdc_app_dashboard_id" {
  description = "Observe OID for the BDC App Metrics dashboard"
  value       = observe_dashboard.bdc_app.id
}
