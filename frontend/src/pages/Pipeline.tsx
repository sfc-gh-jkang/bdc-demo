import { AlertCircle, RefreshCw, CheckCircle2, Play, Loader2 } from 'lucide-react'
import { usePipelineLive, useRunTask } from '@/api/pipeline'
import PipelineFlow from '@/components/PipelineFlow'

export default function Pipeline() {
  const { data, isLoading, isError, refetch } = usePipelineLive()
  const runTask = useRunTask()

  if (isLoading) {
    return (
      <div className="p-6 space-y-5">
        <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data || data.error) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p>Failed to load pipeline metadata.</p>
        {data?.error && <p className="text-xs text-slate-400">{data.error}</p>}
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  const hasTasks = data.tasks.definitions.length > 0

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Data Pipeline</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Live Snowflake object metadata — every layer of this demo runs on Snowflake
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasTasks && (
            <button
              onClick={() => runTask.mutate()}
              disabled={runTask.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {runTask.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              Generate New Data
            </button>
          )}
          <div className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 size={15} />
            <span className="font-medium">Live</span>
          </div>
        </div>
      </div>

      {/* Run task feedback */}
      {runTask.isSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700">
          Task triggered — new data will flow through the pipeline. Dynamic Tables will auto-refresh.
        </div>
      )}
      {runTask.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          Failed to trigger task. The daily generator task may not be created yet.
        </div>
      )}

      {/* Pipeline visualization */}
      <PipelineFlow data={data} />

      {/* Task history */}
      {data.tasks.history.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Task Runs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="pb-2 pr-4 font-medium">Task</th>
                  <th className="pb-2 pr-4 font-medium">State</th>
                  <th className="pb-2 pr-4 font-medium">Started</th>
                  <th className="pb-2 pr-4 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.history.map((run, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 pr-4 text-slate-700 font-medium">{run.name}</td>
                    <td className="py-2 pr-4">
                      <span className={`font-medium ${
                        run.state === 'SUCCEEDED' ? 'text-emerald-600' :
                        run.state === 'FAILED' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {run.state}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{run.started_at || '—'}</td>
                    <td className="py-2 pr-4 text-slate-500">{run.duration_secs != null ? `${run.duration_secs}s` : '—'}</td>
                    <td className="py-2 text-red-500 truncate max-w-[200px]">{run.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Auto-refreshes every 30 seconds · Metadata queried live from Snowflake
      </p>
    </div>
  )
}
