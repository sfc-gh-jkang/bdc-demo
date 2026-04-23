import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useDealer } from '@/context/DealerContext'
import { useCalls, type CallRow, type CallFilters } from '@/api/calls'
import { useAgents } from '@/api/agents'
import DataTable, { type ColumnDef } from '@/components/DataTable'
import SentimentBadge from '@/components/SentimentBadge'

const DISPOSITIONS = [
  'appointment_set',
  'voicemail',
  'no_answer',
  'callback_requested',
  'information_provided',
  'complaint',
  'wrong_number',
  'do_not_call',
]

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const columns: ColumnDef<CallRow>[] = [
  {
    key: 'call_date',
    header: 'Date',
    sortable: true,
    render: (row) => <span className="text-slate-600">{formatDate(row.call_date)}</span>,
  },
  {
    key: 'agent_name',
    header: 'Agent',
    sortable: true,
    render: (row) => <span className="font-medium text-slate-800">{row.agent_name}</span>,
  },
  {
    key: 'direction',
    header: 'Direction',
    sortable: true,
    render: (row) => (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs capitalize">
        {row.direction ?? '—'}
      </span>
    ),
  },
  {
    key: 'duration_seconds',
    header: 'Duration',
    sortable: true,
    render: (row) => formatDuration(row.duration_seconds),
  },
  {
    key: 'disposition',
    header: 'Disposition',
    sortable: true,
    render: (row) => (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{row.disposition}</span>
    ),
  },
  {
    key: 'sentiment_score',
    header: 'Sentiment',
    sortable: true,
    render: (row) => row.sentiment_score !== null
      ? <SentimentBadge score={row.sentiment_score} />
      : <span className="text-slate-400">—</span>,
  },
  {
    key: 'dealer_name',
    header: 'Dealer',
    sortable: true,
  },
]

const PAGE_SIZE = 50

export default function Calls() {
  const [searchParams] = useSearchParams()
  const { dealerId } = useDealer()
  const navigate = useNavigate()
  const { data: agents } = useAgents(dealerId)

  const [offset, setOffset] = useState(0)
  const [agentId, setAgentId] = useState<string>(searchParams.get('agent_id') ?? '')
  const [disposition, setDisposition] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  const filters: CallFilters = {
    dealer_id: dealerId,
    agent_id: agentId || null,
    disposition: disposition || null,
    date_from: dateFrom || null,
    date_to: dateTo || null,
    limit: PAGE_SIZE,
    offset,
  }

  const { data, isLoading, isError, refetch } = useCalls(filters)

  const calls = data?.calls ?? []
  const hasMore = calls.length === PAGE_SIZE
  const page = Math.floor(offset / PAGE_SIZE) + 1

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p>Failed to load calls.</p>
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
        <h2 className="text-xl font-bold text-slate-800">Call Log</h2>
        <p className="text-sm text-slate-500 mt-0.5">Browse and filter call records</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <Filter size={16} className="text-slate-400 self-end mb-1" />

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">Agent</label>
          <select
            value={agentId}
            onChange={(e) => { setAgentId(e.target.value); setOffset(0) }}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          >
            <option value="">All Agents</option>
            {(agents ?? []).map((a) => (
              <option key={a.agent_id} value={a.agent_id}>
                {a.agent_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">Disposition</label>
          <select
            value={disposition}
            onChange={(e) => { setDisposition(e.target.value); setOffset(0) }}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          >
            <option value="">All Dispositions</option>
            {DISPOSITIONS.map((d) => (
              <option key={d} value={d}>
                {d.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setOffset(0) }}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setOffset(0) }}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={() => { setAgentId(''); setDisposition(''); setDateFrom(''); setDateTo(''); setOffset(0) }}
          className="text-sm text-slate-500 hover:text-slate-700 underline self-end pb-1.5"
        >
          Clear
        </button>
      </div>

      <DataTable<CallRow>
        columns={columns}
        data={calls}
        loading={isLoading}
        onRowClick={(row) => navigate(`/calls/${row.call_id}`)}
        emptyMessage="No calls match the current filters."
      />

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} · Showing {calls.length} results
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            disabled={offset === 0}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={!hasMore}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
