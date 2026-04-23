import { useQuery } from '@tanstack/react-query'
import { apiFetch, buildQuery } from './client'

export interface DashboardKPIs {
  total_calls: number
  appointments_set: number
  avg_sentiment: number | null
  avg_call_score: number | null
  conversion_rate: number | null
}

export interface DealerMetric {
  dealer_id: string
  dealer_name: string
  brand: string
  total_calls: number
  active_agents: number
  avg_call_duration: number | null
  appointments_set: number
  conversion_rate: number | null
  avg_sentiment: number | null
  avg_call_score: number | null
  unique_customers: number
  total_talk_time_seconds: number
}

export interface DashboardData {
  kpis: DashboardKPIs
  dealers: DealerMetric[]
}

export function useDashboard(dealerId: string | null) {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', dealerId],
    queryFn: () =>
      apiFetch<DashboardData>(`/dashboard${buildQuery({ dealer_id: dealerId })}`),
  })
}
