import { useQuery } from '@tanstack/react-query'
import { apiFetch, buildQuery } from './client'

export interface AgentRow {
  rank: number
  agent_id: string
  agent_name: string
  dealer_name: string
  dealer_id: string
  skill_tier: string
  total_calls: number
  appointments_set: number
  avg_score: number | null
  avg_sentiment: number | null
  avg_duration: number | null
  composite_score: number | null
}

interface LeaderboardResponse {
  agents: AgentRow[]
}

export function useLeaderboard(dealerId: string | null, sortBy = 'composite_score') {
  return useQuery<AgentRow[]>({
    queryKey: ['leaderboard', dealerId, sortBy],
    queryFn: async () => {
      const res = await apiFetch<LeaderboardResponse>(
        `/leaderboard${buildQuery({ dealer_id: dealerId, sort_by: sortBy })}`
      )
      return res.agents
    },
  })
}
