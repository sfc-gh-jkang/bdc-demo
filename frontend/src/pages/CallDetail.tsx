import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, User, Phone, CalendarDays, AlertCircle, RefreshCw } from 'lucide-react'
import { useCallDetail } from '@/api/calls'
import TranscriptView from '@/components/TranscriptView'
import SentimentBadge from '@/components/SentimentBadge'

function formatDate(s: string): string {
  return new Date(s).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s}s`
}

function MetaChip({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon size={15} className="text-slate-400" />
      <span className="text-slate-400">{label}:</span>
      <span className="text-slate-700 font-medium">{value}</span>
    </div>
  )
}

function ScoreRow({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === undefined) return null
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-600 w-8 text-right">{value.toFixed(0)}</span>
    </div>
  )
}

export default function CallDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useCallDetail(id)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
          ))}
        </div>
        <div className="h-96 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p>Call not found or failed to load.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Call metadata header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-800">Call Detail</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              <MetaChip icon={User} label="Agent" value={data.agent_name} />
              <MetaChip icon={Phone} label="Customer" value={data.customer_name} />
              <MetaChip icon={CalendarDays} label="Date" value={formatDate(data.call_datetime ?? data.call_date)} />
              <MetaChip icon={Clock} label="Duration" value={formatDuration(data.duration_seconds)} />
              <MetaChip icon={Phone} label="Dealer" value={data.dealer_name} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {data.direction && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs capitalize">
                {data.direction}
              </span>
            )}
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
              {data.disposition}
            </span>
            {data.sentiment_score !== null && (
              <SentimentBadge score={data.sentiment_score} />
            )}
          </div>
        </div>
      </div>

      {/* Coaching Scores */}
      {data.scores && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Coaching Scores</h3>
          <div className="space-y-2.5 max-w-lg">
            <ScoreRow label="Greeting" value={data.scores.greeting} />
            <ScoreRow label="Active Listening" value={data.scores.active_listening} />
            <ScoreRow label="Objection Handling" value={data.scores.objection_handling} />
            <ScoreRow label="Product Knowledge" value={data.scores.product_knowledge} />
            <ScoreRow label="Closing" value={data.scores.closing} />
            <ScoreRow label="Professionalism" value={data.scores.professionalism} />
            <ScoreRow label="Overall Score" value={data.scores.overall_score} />
          </div>
        </div>
      )}

      {/* Transcript + AI Analysis */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Transcript</h3>
        <TranscriptView
          transcript={data.transcript}
          callSummary={data.call_summary}
          sentimentScore={data.sentiment_score}
          sentimentLabel={data.sentiment_label}
          disposition={data.disposition}
          followUpAction={data.follow_up_action}
          customerObjections={data.customer_objections}
        />
      </div>
    </div>
  )
}
