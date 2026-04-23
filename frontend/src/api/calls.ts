import { useQuery } from '@tanstack/react-query'
import { apiFetch, buildQuery } from './client'

export interface CallRow {
  call_id: string
  agent_id: string
  agent_name: string
  dealer_id: string
  dealer_name: string
  call_date: string
  duration_seconds: number
  disposition: string
  sentiment_score: number | null
  sentiment_label: string | null
  call_type: string | null
  direction: string | null
}

export interface TranscriptTurn {
  speaker: string
  speaker_name: string
  text: string
  offset_seconds: number
}

export interface CallScores {
  greeting: number | null
  active_listening: number | null
  objection_handling: number | null
  product_knowledge: number | null
  closing: number | null
  professionalism: number | null
  overall_score: number | null
}

export interface CallDetailData {
  call_id: string
  agent_id: string
  agent_name: string
  dealer_id: string
  dealer_name: string
  call_date: string
  call_datetime: string | null
  duration_seconds: number
  disposition: string
  disposition_class: string | null
  direction: string | null
  call_type: string | null
  skill_tier: string | null
  customer_id: string | null
  customer_name: string
  sentiment_score: number | null
  sentiment_label: string | null
  call_summary: string | null
  follow_up_action: string | null
  customer_objections: string | null
  scores: CallScores
  word_count: number | null
  transcript: TranscriptTurn[]
}

export interface CallFilters {
  agent_id?: string | null
  dealer_id?: string | null
  disposition?: string | null
  date_from?: string | null
  date_to?: string | null
  limit?: number
  offset?: number
}

export interface CallsResponse {
  calls: CallRow[]
  limit: number
  offset: number
}

export function useCalls(filters: CallFilters) {
  return useQuery<CallsResponse>({
    queryKey: ['calls', filters],
    queryFn: () =>
      apiFetch<CallsResponse>(`/calls${buildQuery({ ...filters })}`),
  })
}

export function useCallDetail(callId: string | undefined) {
  return useQuery<CallDetailData>({
    queryKey: ['call', callId],
    queryFn: () => apiFetch<CallDetailData>(`/calls/${callId}`),
    enabled: !!callId,
  })
}
