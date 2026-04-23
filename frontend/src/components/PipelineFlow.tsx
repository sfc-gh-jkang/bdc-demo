import { useState } from 'react'
import {
  Database,
  Waves,
  HardDrive,
  Table2,
  RefreshCw,
  Zap,
  Search,
  Bot,
  Container,
  ChevronDown,
  ChevronRight,
  X,
  ArrowDown,
} from 'lucide-react'
import type {
  PipelineLiveResponse,
  SourceObject,
  RawTable,
  DynamicTableObject,
  SearchService,
  AgentObject,
  SPCSContainer,
} from '@/api/pipeline'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRows(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return 'Never'
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 0) return 'Just now'
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type StatusLevel = 'healthy' | 'warning' | 'error' | 'neutral'

const STATUS_STYLES: Record<StatusLevel, { dot: string; bg: string; text: string; border: string }> = {
  healthy: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  error: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
  neutral: { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
}

function StatusDot({ level }: { level: StatusLevel }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${STATUS_STYLES[level].dot}`} />
}

// ── Tier configs ─────────────────────────────────────────────────────────────

interface TierConfig {
  color: string        // left border color
  badgeBg: string      // feature badge background
  badgeText: string    // feature badge text color
}

const TIER_STYLES: Record<string, TierConfig> = {
  source:    { color: 'border-l-indigo-500', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700' },
  raw:       { color: 'border-l-slate-500',  badgeBg: 'bg-slate-100',  badgeText: 'text-slate-700' },
  analytics: { color: 'border-l-emerald-500', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
  coaching:  { color: 'border-l-violet-500', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700' },
  app:       { color: 'border-l-cyan-500',   badgeBg: 'bg-cyan-100',   badgeText: 'text-cyan-700' },
}

// ── Node cards ───────────────────────────────────────────────────────────────

function SourceCard({ obj }: { obj: SourceObject }) {
  const icons = { postgres: Database, pg_lake: Waves, iceberg: HardDrive }
  const Icon = icons[obj.type] || Database
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 min-w-[140px] hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} className="text-indigo-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 truncate">{obj.name}</span>
      </div>
      {obj.description && <p className="text-xs text-slate-500 leading-relaxed">{obj.description}</p>}
      <div className="flex items-center gap-3 mt-1">
        {obj.tables != null && (
          <p className="text-xs text-slate-400">{obj.tables} tables</p>
        )}
        {obj.last_refresh && (
          <p className="text-xs text-slate-400">
            <span className="text-slate-300">Last: </span>{timeAgo(obj.last_refresh)}
          </p>
        )}
      </div>
    </div>
  )
}

function RawCard({ obj }: { obj: RawTable }) {
  const isIceberg = obj.type === 'iceberg'
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-2.5 min-w-[100px] text-center hover:shadow-md transition-shadow">
      {isIceberg ? (
        <HardDrive size={12} className="text-indigo-400 mx-auto mb-1" />
      ) : (
        <Table2 size={12} className="text-slate-400 mx-auto mb-1" />
      )}
      <p className="text-xs font-semibold text-slate-700 truncate">{obj.name}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{formatRows(obj.rows)}</p>
      {obj.last_refresh && (
        <p className="text-[11px] text-slate-400 mt-0.5">
          <span className="text-slate-300">Last: </span>{timeAgo(obj.last_refresh)}
        </p>
      )}
    </div>
  )
}

function DTCard({ obj, onClick }: { obj: DynamicTableObject; onClick: () => void }) {
  const isActive = obj.scheduling_state === 'ACTIVE'
  const level: StatusLevel = isActive ? 'healthy' : 'warning'
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-lg border ${STATUS_STYLES[level].border} p-3 min-w-[160px] text-left hover:shadow-md transition-shadow cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <RefreshCw size={12} className="text-emerald-500" />
          <span className="text-sm font-semibold text-slate-800 truncate">{obj.name}</span>
        </div>
        <StatusDot level={level} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400">Rows: </span>{formatRows(obj.rows)}
        </p>
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400">Lag: </span>{obj.target_lag || '—'}
        </p>
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400">Last: </span>{timeAgo(obj.last_refresh)}
        </p>
      </div>
    </button>
  )
}

function ITCard({ obj, onClick }: { obj: DynamicTableObject; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg border border-amber-200 p-3 min-w-[140px] text-left hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Zap size={12} className="text-amber-500" />
        <span className="text-sm font-semibold text-slate-800 truncate">{obj.name}</span>
      </div>
      <div className="space-y-0.5">
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400">Rows: </span>{formatRows(obj.rows)}
        </p>
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400">Lag: </span>{obj.target_lag || '—'}
        </p>
      </div>
    </button>
  )
}

function SearchCard({ obj, onClick }: { obj: SearchService; onClick: () => void }) {
  const isActive = obj.serving_state === 'ACTIVE'
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-lg border ${isActive ? 'border-blue-200' : 'border-slate-200'} p-3 min-w-[180px] text-left hover:shadow-md transition-shadow cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Search size={12} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-800 truncate">{obj.name}</span>
        </div>
        <StatusDot level={isActive ? 'healthy' : 'warning'} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400">Docs: </span>{formatRows(obj.rows)}
        </p>
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400">Model: </span>{obj.embedding_model || '—'}
        </p>
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400">Index: </span>
          <span className={obj.indexing_state === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'}>
            {obj.indexing_state || '—'}
          </span>
        </p>
      </div>
    </button>
  )
}

function AgentCard({ obj, onClick }: { obj: AgentObject; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg border border-violet-200 p-3 min-w-[160px] text-left hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Bot size={12} className="text-violet-500" />
        <span className="text-sm font-semibold text-slate-800 truncate">{obj.name}</span>
      </div>
      <p className="text-[11px] text-slate-500 line-clamp-2">{obj.comment || 'Cortex Agent'}</p>
    </button>
  )
}

function SPCSCard({ c }: { c: SPCSContainer }) {
  const level: StatusLevel = c.status === 'READY' ? 'healthy' : c.status === 'PENDING' ? 'warning' : 'error'
  return (
    <div className={`bg-white rounded-lg border ${STATUS_STYLES[level].border} p-3 min-w-[130px]`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Container size={12} className="text-cyan-500" />
          <span className="text-sm font-semibold text-slate-800">{c.name}</span>
        </div>
        <StatusDot level={level} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[11px] text-slate-500">
          <span className={`font-medium ${STATUS_STYLES[level].text}`}>{c.status}</span>
        </p>
        {c.image && (
          <p className="text-[11px] text-slate-400 truncate">{c.image}</p>
        )}
      </div>
    </div>
  )
}

// ── Tier arrow connector ─────────────────────────────────────────────────────

function TierArrow() {
  return (
    <div className="flex justify-center py-1">
      <ArrowDown size={18} className="text-slate-300" />
    </div>
  )
}

// ── Tier wrapper ─────────────────────────────────────────────────────────────

function TierSection({
  tierKey,
  label,
  description,
  feature,
  children,
  defaultOpen = true,
}: {
  tierKey: string
  label: string
  description: string
  feature: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const style = TIER_STYLES[tierKey] || TIER_STYLES.raw

  return (
    <div className={`border-l-4 ${style.color} bg-white rounded-r-xl border border-l-0 border-slate-200`}
         style={{ boxShadow: 'var(--card-shadow)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
      >
        {open ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-slate-800">{label}</span>
          <span className="text-xs text-slate-400 ml-2">{description}</span>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText}`}>
          {feature}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Detail panel ─────────────────────────────────────────────────────────────

type DetailItem =
  | { type: 'dt'; obj: DynamicTableObject }
  | { type: 'search'; obj: SearchService }
  | { type: 'agent'; obj: AgentObject }

function DetailPanel({ item, onClose }: { item: DetailItem; onClose: () => void }) {
  return (
    <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">
          {item.type === 'dt' ? item.obj.name : item.type === 'search' ? item.obj.name : item.obj.name}
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
          <X size={16} />
        </button>
      </div>

      {item.type === 'dt' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Schema</p>
            <p className="text-slate-700">{item.obj.schema}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Rows</p>
            <p className="text-slate-700">{formatRows(item.obj.rows)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Target Lag</p>
            <p className="text-slate-700">{item.obj.target_lag || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Refresh Mode</p>
            <p className="text-slate-700">{item.obj.refresh_mode || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Scheduling</p>
            <p className="text-slate-700">{item.obj.scheduling_state || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Warehouse</p>
            <p className="text-slate-700">{item.obj.warehouse || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Last Refresh</p>
            <p className="text-slate-700">{timeAgo(item.obj.last_refresh)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Duration</p>
            <p className="text-slate-700">{item.obj.refresh_duration_secs != null ? `${item.obj.refresh_duration_secs}s` : '—'}</p>
          </div>
        </div>
      )}

      {item.type === 'search' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Documents</p>
            <p className="text-slate-700">{formatRows(item.obj.rows)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Search Column</p>
            <p className="text-slate-700">{item.obj.search_column || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Embedding Model</p>
            <p className="text-slate-700 text-xs">{item.obj.embedding_model || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Target Lag</p>
            <p className="text-slate-700">{item.obj.target_lag || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Indexing</p>
            <p className={item.obj.indexing_state === 'ACTIVE' ? 'text-emerald-600 font-medium' : 'text-amber-600'}>
              {item.obj.indexing_state || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Serving</p>
            <p className={item.obj.serving_state === 'ACTIVE' ? 'text-emerald-600 font-medium' : 'text-amber-600'}>
              {item.obj.serving_state || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Warehouse</p>
            <p className="text-slate-700">{item.obj.warehouse || '—'}</p>
          </div>
        </div>
      )}

      {item.type === 'agent' && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Created</p>
            <p className="text-slate-700">{timeAgo(item.obj.created_on)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Description</p>
            <p className="text-slate-700 text-xs">{item.obj.comment || '—'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface PipelineFlowProps {
  data: PipelineLiveResponse
}

export default function PipelineFlow({ data }: PipelineFlowProps) {
  const [detail, setDetail] = useState<DetailItem | null>(null)
  const { tiers } = data

  return (
    <div className="space-y-1">
      {/* Source Layer */}
      <TierSection tierKey="source" label={tiers.source.label} description={tiers.source.description} feature={tiers.source.feature}>
        <div className="flex flex-wrap gap-3">
          {tiers.source.objects.map((obj) => (
            <SourceCard key={obj.name} obj={obj} />
          ))}
        </div>
      </TierSection>

      <TierArrow />

      {/* Raw Layer */}
      <TierSection tierKey="raw" label={tiers.raw.label} description={tiers.raw.description} feature={tiers.raw.feature}>
        <div className="flex flex-wrap gap-2">
          {tiers.raw.objects.map((obj) => (
            <RawCard key={obj.name} obj={obj} />
          ))}
        </div>
        {data.data_range.total_calls != null && (
          <p className="text-[11px] text-slate-400 mt-2">
            Data range: {data.data_range.min_date} → {data.data_range.max_date} · {formatRows(data.data_range.total_calls)} total calls
          </p>
        )}
      </TierSection>

      <TierArrow />

      {/* Analytics Layer (Dynamic Tables) */}
      <TierSection tierKey="analytics" label={tiers.analytics.label} description={tiers.analytics.description} feature={tiers.analytics.feature}>
        <div className="flex flex-wrap gap-3">
          {tiers.analytics.objects.map((dt) => (
            <DTCard key={`${dt.schema}.${dt.name}`} obj={dt} onClick={() => setDetail({ type: 'dt', obj: dt })} />
          ))}
        </div>
      </TierSection>

      <TierArrow />

      {/* Coaching Layer (Interactive Tables + Cortex AI) */}
      <TierSection tierKey="coaching" label={tiers.coaching.label} description={tiers.coaching.description} feature={tiers.coaching.feature}>
        {/* Interactive Tables */}
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Interactive Tables</p>
          <div className="flex flex-wrap gap-3">
            {tiers.coaching.objects.interactive_tables.map((it) => (
              <ITCard key={`${it.schema}.${it.name}`} obj={it} onClick={() => setDetail({ type: 'dt', obj: it })} />
            ))}
          </div>
        </div>
        {/* Cortex AI */}
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Cortex AI Services</p>
          <div className="flex flex-wrap gap-3">
            {tiers.coaching.objects.search_services.map((s) => (
              <SearchCard key={s.name} obj={s} onClick={() => setDetail({ type: 'search', obj: s })} />
            ))}
            {tiers.coaching.objects.agents.map((a) => (
              <AgentCard key={a.name} obj={a} onClick={() => setDetail({ type: 'agent', obj: a })} />
            ))}
          </div>
        </div>
      </TierSection>

      <TierArrow />

      {/* App Layer (SPCS) */}
      <TierSection tierKey="app" label={tiers.app.label} description={tiers.app.description} feature={tiers.app.feature}>
        <div className="flex flex-wrap gap-3">
          {tiers.app.containers.map((c) => (
            <SPCSCard key={c.name} c={c} />
          ))}
        </div>
      </TierSection>

      {/* Detail panel */}
      {detail && <DetailPanel item={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
