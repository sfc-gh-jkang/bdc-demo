import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, User, Phone, CalendarDays, Trophy, Star,
  AlertCircle, RefreshCw, Sparkles, Loader2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAgent, streamAgentSummary, type RecentCall, type CortexMetadata } from '@/api/agents'
import DataTable from '@/components/DataTable'
import type { ColumnDef } from '@/components/DataTable'
import SentimentBadge from '@/components/SentimentBadge'
import CoachingChat from '@/components/CoachingChat'

function formatDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Phone }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        <Icon size={14} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-16">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600 w-8 text-right">{score.toFixed(0)}</span>
    </div>
  )
}

function MetadataPill({ meta }: { meta?: CortexMetadata }) {
  if (!meta || (!meta.model && !meta.latency_ms)) return null
  const parts: string[] = []
  if (meta.model) parts.push(meta.model)
  if (meta.input_tokens != null && meta.output_tokens != null) {
    let tok = `${meta.input_tokens} in / ${meta.output_tokens} out tokens`
    if (meta.cache_read_tokens) tok += ` (${meta.cache_read_tokens} cached)`
    parts.push(tok)
  }
  if (meta.latency_ms != null) parts.push(`${(meta.latency_ms / 1000).toFixed(1)}s`)
  return (
    <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
      {parts.join(' · ')}
    </div>
  )
}

const callColumns: ColumnDef<RecentCall>[] = [
  {
    key: 'call_date',
    header: 'Date',
    sortable: true,
    render: (row) => <span className="text-slate-600">{formatDate(row.call_date)}</span>,
  },
  {
    key: 'disposition',
    header: 'Disposition',
    render: (row) => (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs capitalize">
        {row.disposition?.replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    key: 'duration_seconds',
    header: 'Duration',
    sortable: true,
    render: (row) => (
      <span className="text-slate-600">{Math.floor(row.duration_seconds / 60)}m {row.duration_seconds % 60}s</span>
    ),
  },
  {
    key: 'overall_score',
    header: 'Score',
    sortable: true,
    render: (row) => row.overall_score != null ? <ScoreBar score={row.overall_score} /> : <span className="text-slate-400">—</span>,
  },
  {
    key: 'sentiment_score',
    header: 'Sentiment',
    sortable: true,
    render: (row) => row.sentiment_score != null ? <SentimentBadge score={row.sentiment_score} /> : <span className="text-slate-400">—</span>,
  },
]

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useAgent(id)

  // Streaming summary state
  const [summaryText, setSummaryText] = useState('')
  const [summaryMeta, setSummaryMeta] = useState<CortexMetadata | undefined>()
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summarySteps, setSummarySteps] = useState<string[]>([])
  const [summaryLoaded, setSummaryLoaded] = useState(false)

  const loadSummary = useCallback(async (agentId: string) => {
    setSummaryText('')
    setSummaryMeta(undefined)
    setSummaryLoading(true)
    setSummarySteps([])
    try {
      const meta = await streamAgentSummary(
        agentId,
        (chunk) => setSummaryText((prev) => prev + chunk),
        (status) => setSummarySteps((prev) => {
          if (prev.length > 0 && prev[prev.length - 1] === status) return prev
          return [...prev, status]
        }),
      )
      setSummaryMeta(meta)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate summary'
      setSummaryText((prev) => prev || `Error: ${msg}`)
    } finally {
      setSummaryLoading(false)
      setSummaryLoaded(true)
    }
  }, [])

  // Auto-load summary when agent data loads
  useEffect(() => {
    if (data?.agent_id && !summaryLoaded && !summaryLoading) {
      loadSummary(data.agent_id)
    }
  }, [data?.agent_id, summaryLoaded, summaryLoading, loadSummary])

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p>Agent not found or failed to load.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  const m = data.metrics

  return (
    <div className="p-6 space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Agent profile header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{data.agent_name}</h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Phone size={13} /> {data.dealer_name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium capitalize">
              {data.skill_tier} tier
            </span>
            {m.rank && (
              <span className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
                <Trophy size={13} /> Rank #{m.rank}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Phone} label="Total Calls" value={m.total_calls.toLocaleString()} />
        <StatCard icon={CalendarDays} label="Appointments" value={m.appointments_set} />
        <StatCard icon={Star} label="Avg Score" value={m.avg_score?.toFixed(1) ?? '—'} />
        <StatCard icon={Trophy} label="Composite" value={m.composite_score?.toFixed(1) ?? '—'} />
      </div>

      {/* AI Coaching Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">AI Coaching Summary</h3>
            <span className="text-xs text-slate-400">Powered by Snowflake Cortex</span>
          </div>
          <button
            onClick={() => data && loadSummary(data.agent_id)}
            disabled={summaryLoading}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {summaryLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Regenerate
          </button>
        </div>
        {summaryLoading && !summaryText ? (
          <div className="space-y-1.5 py-1">
            {summarySteps.map((step, si) => (
              <div key={si} className="flex items-center gap-1.5 text-slate-400 text-xs">
                {si < summarySteps.length - 1 ? (
                  <span className="text-emerald-500">✓</span>
                ) : (
                  <Loader2 size={10} className="animate-spin shrink-0" />
                )}
                <span>{step}</span>
              </div>
            ))}
            {summarySteps.length === 0 && (
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Loader2 size={10} className="animate-spin" /> Thinking...
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="prose prose-sm prose-slate max-w-none">
              <ReactMarkdown>{summaryText || 'No summary available.'}</ReactMarkdown>
            </div>
            <MetadataPill meta={summaryMeta} />
          </>
        )}
      </div>

      {/* Recent Calls */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Calls</h3>
        <DataTable<RecentCall>
          columns={callColumns}
          data={data.recent_calls}
          onRowClick={(row) => navigate(`/calls/${row.call_id}`)}
          emptyMessage="No recent calls found."
        />
      </div>

      {/* Coaching Chat */}
      <CoachingChat agentId={data.agent_id} agentName={data.agent_name} />
    </div>
  )
}
