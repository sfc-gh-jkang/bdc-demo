import { useQuery } from '@tanstack/react-query'
import { apiFetch, buildQuery } from './client'

// ---------------------------------------------------------------------------
// Agent list (same shape as leaderboard but from /api/agents)
// ---------------------------------------------------------------------------

export interface AgentListItem {
  agent_id: string
  agent_name: string
  dealer_id: string
  dealer_name: string
  skill_tier: string
  total_calls: number
  appointments_set: number
  avg_score: number | null
  avg_sentiment: number | null
  avg_duration: number | null
  composite_score: number | null
  rank: number
}

// ---------------------------------------------------------------------------
// Agent detail
// ---------------------------------------------------------------------------

export interface AgentMetrics {
  total_calls: number
  appointments_set: number
  avg_score: number | null
  avg_sentiment: number | null
  avg_duration: number | null
  composite_score: number | null
  rank: number
}

export interface RecentCall {
  call_id: string
  call_date: string | null
  duration_seconds: number
  disposition: string
  sentiment_score: number | null
  sentiment_label: string | null
  overall_score: number | null
}

export interface AgentDetailData {
  agent_id: string
  agent_name: string
  dealer_id: string
  dealer_name: string
  skill_tier: string
  metrics: AgentMetrics
  recent_calls: RecentCall[]
}

// ---------------------------------------------------------------------------
// AI Coaching summary
// ---------------------------------------------------------------------------

export interface CortexMetadata {
  model?: string
  input_tokens?: number
  output_tokens?: number
  cache_read_tokens?: number
  latency_ms?: number
  request_id?: string
  run_id?: string
}

export interface AgentSummary {
  summary: string
  generated_at: string
  metadata?: CortexMetadata
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAgents(dealerId: string | null) {
  return useQuery<AgentListItem[]>({
    queryKey: ['agents', dealerId],
    queryFn: async () => {
      const res = await apiFetch<{ agents: AgentListItem[] }>(
        `/agents${buildQuery({ dealer_id: dealerId })}`,
      )
      return res.agents
    },
  })
}

export function useAgent(agentId: string | undefined) {
  return useQuery<AgentDetailData>({
    queryKey: ['agent', agentId],
    queryFn: () => apiFetch<AgentDetailData>(`/agents/${agentId}`),
    enabled: !!agentId,
  })
}

export function useAgentSummary(agentId: string | undefined) {
  return useQuery<AgentSummary>({
    queryKey: ['agent-summary', agentId],
    queryFn: () => apiFetch<AgentSummary>(`/agents/${agentId}/summary`),
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes — LLM calls are expensive
    retry: 1,
  })
}

/**
 * Stream the agent summary via SSE (same pattern as chat).
 * Falls back to JSON for non-SPCS environments.
 */
export async function streamAgentSummary(
  agentId: string,
  onChunk: (text: string) => void,
  onStatus?: (message: string) => void,
): Promise<CortexMetadata | undefined> {
  const res = await fetch(`/api/agents/${agentId}/summary`)

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  // JSON fallback (non-SPCS)
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const data = await res.json()
    if (data.summary) onChunk(data.summary)
    return data.metadata
  }

  // SSE streaming
  const reader = res.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let metadata: CortexMetadata | undefined

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        if (!part.trim()) continue

        let eventType = 'message'
        let data = ''
        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim()
          else if (line.startsWith('data: ')) data = line.slice(6)
        }

        if (eventType === 'delta' && data) {
          try { const p = JSON.parse(data); if (p.text) onChunk(p.text) } catch { /* skip */ }
        } else if (eventType === 'status' && data) {
          try { const p = JSON.parse(data); if (p.message && onStatus) onStatus(p.message) } catch { /* skip */ }
        } else if (eventType === 'metadata' && data) {
          try { metadata = JSON.parse(data) as CortexMetadata } catch { /* skip */ }
        } else if (eventType === 'error' && data) {
          try { const p = JSON.parse(data); onChunk(`\n\n[Error: ${p.message}]`) } catch { onChunk('\n\n[Error]') }
        } else if (eventType === 'done') {
          break
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return metadata
}

// ---------------------------------------------------------------------------
// Chat (imperative — not a hook, used with streaming fetch)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  metadata?: CortexMetadata
}

export async function sendChatMessage(
  agentId: string,
  message: string,
  history: ChatMessage[],
  onChunk: (text: string) => void,
  onStatus?: (message: string) => void,
): Promise<CortexMetadata | undefined> {
  console.log(`[Chat] Sending to /api/agents/${agentId}/chat`, { message, historyLen: history.length })

  const res = await fetch(`/api/agents/${agentId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    console.error(`[Chat] HTTP ${res.status}:`, text)
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  // SSE streaming: read the response body as a stream of events
  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let metadata: CortexMetadata | undefined

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE events (separated by double newline)
      const parts = buffer.split('\n\n')
      // Keep the last incomplete part in the buffer
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        if (!part.trim()) continue

        let eventType = 'message'
        let data = ''

        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            data = line.slice(6)
          }
        }

        if (eventType === 'delta' && data) {
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              onChunk(parsed.text)
            }
          } catch {
            console.warn('[Chat] Failed to parse delta:', data)
          }
        } else if (eventType === 'status' && data) {
          try {
            const parsed = JSON.parse(data)
            if (parsed.message && onStatus) onStatus(parsed.message)
          } catch {
            console.warn('[Chat] Failed to parse status:', data)
          }
        } else if (eventType === 'metadata' && data) {
          try {
            metadata = JSON.parse(data) as CortexMetadata
            console.log('[Chat] Metadata:', metadata)
          } catch {
            console.warn('[Chat] Failed to parse metadata:', data)
          }
        } else if (eventType === 'error' && data) {
          try {
            const parsed = JSON.parse(data)
            throw new Error(parsed.message || 'Unknown agent error')
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unknown agent error') throw e
            throw new Error(data)
          }
        } else if (eventType === 'done') {
          // Stream complete
          console.log('[Chat] Stream done')
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return metadata
}
