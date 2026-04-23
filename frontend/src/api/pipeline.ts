import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

// ── Source tier ──────────────────────────────────────────────────────────────

export interface SourceObject {
  name: string
  type: 'postgres' | 'pg_lake' | 'iceberg'
  description?: string
  tables?: number
  last_refresh?: string | null
}

// ── Raw tier ─────────────────────────────────────────────────────────────────

export interface RawTable {
  name: string
  type: 'table' | 'iceberg'
  rows: number | null
  last_refresh?: string | null
}

// ── Dynamic Table (analytics + coaching tiers) ───────────────────────────────

export interface DynamicTableObject {
  name: string
  schema: string
  rows: number | null
  target_lag: string | null
  scheduling_state: string | null
  refresh_mode: string | null
  warehouse: string | null
  last_refresh: string | null
  refresh_duration_secs: number | null
  rows_inserted: number | null
}

// ── Cortex Search ────────────────────────────────────────────────────────────

export interface SearchService {
  name: string
  search_column: string | null
  rows: number | null
  indexing_state: string | null
  serving_state: string | null
  embedding_model: string | null
  target_lag: string | null
  warehouse: string | null
}

// ── Cortex Agent ─────────────────────────────────────────────────────────────

export interface AgentObject {
  name: string
  created_on: string | null
  comment: string | null
}

// ── SPCS container ───────────────────────────────────────────────────────────

export interface SPCSContainer {
  name: string
  status: string | null
  message: string | null
  restart_count: number | null
  start_time: string | null
  image: string | null
}

// ── Task ─────────────────────────────────────────────────────────────────────

export interface TaskDefinition {
  name: string
  schema: string | null
  schedule: string | null
  state: string | null
  warehouse: string | null
  definition: string | null
  last_committed_on: string | null
}

export interface TaskRun {
  name: string
  schema: string | null
  state: string | null
  started_at: string | null
  completed_at: string | null
  duration_secs: number | null
  error: string | null
}

// ── Tier shapes ──────────────────────────────────────────────────────────────

export interface SourceTier {
  label: string
  description: string
  feature: string
  objects: SourceObject[]
}

export interface RawTier {
  label: string
  description: string
  feature: string
  objects: RawTable[]
}

export interface AnalyticsTier {
  label: string
  description: string
  feature: string
  objects: DynamicTableObject[]
}

export interface CoachingTier {
  label: string
  description: string
  feature: string
  objects: {
    interactive_tables: DynamicTableObject[]
    search_services: SearchService[]
    agents: AgentObject[]
  }
}

export interface AppTier {
  label: string
  description: string
  feature: string
  containers: SPCSContainer[]
}

// ── Full response ────────────────────────────────────────────────────────────

export interface PipelineLiveResponse {
  tiers: {
    source: SourceTier
    raw: RawTier
    analytics: AnalyticsTier
    coaching: CoachingTier
    app: AppTier
  }
  tasks: {
    definitions: TaskDefinition[]
    history: TaskRun[]
  }
  data_range: {
    min_date?: string | null
    max_date?: string | null
    total_calls?: number | null
  }
  error?: string
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function usePipelineLive() {
  return useQuery<PipelineLiveResponse>({
    queryKey: ['pipeline-live'],
    queryFn: () => apiFetch<PipelineLiveResponse>('/pipeline-live'),
    refetchInterval: 30_000,
  })
}

export function useRunTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ status: string; message: string }>('/pipeline/run-task', { method: 'POST' }),
    onSuccess: () => {
      // Refetch pipeline data after task triggers
      setTimeout(() => qc.invalidateQueries({ queryKey: ['pipeline-live'] }), 3000)
    },
  })
}
