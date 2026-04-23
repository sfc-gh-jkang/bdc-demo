import { Phone, Smile, CalendarCheck, Star, AlertCircle, RefreshCw } from 'lucide-react'
import { useDealer } from '@/context/DealerContext'
import { useDashboard, type DealerMetric } from '@/api/dashboard'
import KPICard from '@/components/KPICard'
import DataTable, { type ColumnDef } from '@/components/DataTable'
import SnowflakeFeatures from '@/components/SnowflakeFeatures'

function formatPercent(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function formatDuration(secs: number | null): string {
  if (secs === null || secs === undefined) return '—'
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const dealerColumns: ColumnDef<DealerMetric>[] = [
  {
    key: 'dealer_name',
    header: 'Dealer',
    sortable: true,
    render: (row) => (
      <div>
        <span className="font-medium text-slate-800">{row.dealer_name}</span>
        <span className="ml-2 text-xs text-slate-400">{row.brand}</span>
      </div>
    ),
  },
  {
    key: 'total_calls',
    header: 'Calls',
    sortable: true,
    render: (row) => <span>{row.total_calls.toLocaleString()}</span>,
  },
  {
    key: 'active_agents',
    header: 'Agents',
    sortable: true,
  },
  {
    key: 'appointments_set',
    header: 'Appts',
    sortable: true,
  },
  {
    key: 'conversion_rate',
    header: 'Conversion',
    sortable: true,
    render: (row) => <span>{formatPercent(row.conversion_rate)}</span>,
  },
  {
    key: 'avg_sentiment',
    header: 'Sentiment',
    sortable: true,
    render: (row) => {
      if (row.avg_sentiment === null) return <span className="text-slate-400">—</span>
      const v = row.avg_sentiment
      const cls = v >= 0.3 ? 'text-emerald-600' : v <= -0.3 ? 'text-red-600' : 'text-amber-600'
      return <span className={cls}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>
    },
  },
  {
    key: 'avg_call_score',
    header: 'Avg Score',
    sortable: true,
    render: (row) => <span>{row.avg_call_score !== null ? row.avg_call_score.toFixed(1) : '—'}</span>,
  },
  {
    key: 'avg_call_duration',
    header: 'Avg Duration',
    sortable: true,
    render: (row) => <span>{formatDuration(row.avg_call_duration)}</span>,
  },
]

export default function Dashboard() {
  const { dealerId } = useDealer()
  const { data, isLoading, isError, refetch } = useDashboard(dealerId)

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p>Failed to load dashboard data.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  const kpis = data?.kpis

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Overview</h2>
        <p className="text-sm text-slate-500 mt-0.5">BDC performance across all dealers</p>
      </div>

      <SnowflakeFeatures />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-28 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-24 mb-3" />
              <div className="h-7 bg-slate-200 rounded w-16 mb-3" />
            </div>
          ))
        ) : (
          <>
            <KPICard
              icon={Phone}
              label="Total Calls"
              value={kpis?.total_calls.toLocaleString() ?? '—'}
              iconColor="text-blue-500"
            />
            <KPICard
              icon={CalendarCheck}
              label="Appointments Set"
              value={kpis?.appointments_set?.toLocaleString() ?? '—'}
              iconColor="text-violet-500"
            />
            <KPICard
              icon={Smile}
              label="Avg Sentiment"
              value={kpis?.avg_sentiment != null ? (kpis.avg_sentiment >= 0 ? '+' : '') + kpis.avg_sentiment.toFixed(2) : '—'}
              iconColor="text-emerald-500"
            />
            <KPICard
              icon={Star}
              label="Avg Call Score"
              value={kpis?.avg_call_score != null ? kpis.avg_call_score.toFixed(1) : '—'}
              iconColor="text-amber-500"
            />
          </>
        )}
      </div>

      {/* Dealer Breakdown Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Dealer Breakdown</h3>
        <DataTable<DealerMetric>
          columns={dealerColumns}
          data={data?.dealers ?? []}
          loading={isLoading}
          emptyMessage="No dealer data found."
        />
      </div>
    </div>
  )
}
