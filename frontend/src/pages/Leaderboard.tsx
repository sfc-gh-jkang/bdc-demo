import { useNavigate } from 'react-router-dom'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useDealer } from '@/context/DealerContext'
import { useLeaderboard, type AgentRow } from '@/api/leaderboard'
import DataTable from '@/components/DataTable'
import type { ColumnDef } from '@/components/DataTable'
import SentimentBadge from '@/components/SentimentBadge'

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-24">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-600 w-8 text-right">{score.toFixed(0)}</span>
    </div>
  )
}

const columns: ColumnDef<AgentRow>[] = [
  {
    key: 'rank',
    header: 'Rank',
    sortable: true,
    className: 'w-16',
    render: (row) => (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
        {row.rank}
      </span>
    ),
  },
  {
    key: 'agent_name',
    header: 'Agent',
    sortable: true,
    render: (row) => (
      <span className="font-medium text-slate-800">{row.agent_name}</span>
    ),
  },
  {
    key: 'dealer_name',
    header: 'Dealer',
    sortable: true,
  },
  {
    key: 'skill_tier',
    header: 'Tier',
    sortable: true,
    render: (row) => (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{row.skill_tier}</span>
    ),
  },
  {
    key: 'composite_score',
    header: 'Score',
    sortable: true,
    render: (row) => <ScoreBar score={row.composite_score ?? 0} />,
  },
  {
    key: 'avg_sentiment',
    header: 'Sentiment',
    sortable: true,
    render: (row) => row.avg_sentiment !== null ? <SentimentBadge score={row.avg_sentiment} /> : <span className="text-slate-400">—</span>,
  },
  {
    key: 'appointments_set',
    header: 'Appts',
    sortable: true,
    render: (row) => (
      <span className="text-slate-700">{row.appointments_set}</span>
    ),
  },
  {
    key: 'total_calls',
    header: 'Calls',
    sortable: true,
    render: (row) => (
      <span className="text-slate-700">{row.total_calls.toLocaleString()}</span>
    ),
  },
]

export default function Leaderboard() {
  const { dealerId } = useDealer()
  const { data, isLoading, isError, refetch } = useLeaderboard(dealerId)
  const navigate = useNavigate()

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p>Failed to load leaderboard.</p>
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
      <div>
        <h2 className="text-xl font-bold text-slate-800">Agent Leaderboard</h2>
        <p className="text-sm text-slate-500 mt-0.5">Ranked by composite coaching score</p>
      </div>
      <DataTable<AgentRow>
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        onRowClick={(row) => navigate(`/agents/${row.agent_id}`)}
        emptyMessage="No agents found for this dealer."
      />
    </div>
  )
}
