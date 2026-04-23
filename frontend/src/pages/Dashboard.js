import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Phone, Smile, CalendarCheck, Star, AlertCircle, RefreshCw } from 'lucide-react';
import { useDealer } from '@/context/DealerContext';
import { useDashboard } from '@/api/dashboard';
import KPICard from '@/components/KPICard';
import DataTable from '@/components/DataTable';
import SnowflakeFeatures from '@/components/SnowflakeFeatures';
function formatPercent(n) {
    if (n === null || n === undefined)
        return '—';
    return `${(n * 100).toFixed(1)}%`;
}
function formatDuration(secs) {
    if (secs === null || secs === undefined)
        return '—';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
const dealerColumns = [
    {
        key: 'dealer_name',
        header: 'Dealer',
        sortable: true,
        render: (row) => (_jsxs("div", { children: [_jsx("span", { className: "font-medium text-slate-800", children: row.dealer_name }), _jsx("span", { className: "ml-2 text-xs text-slate-400", children: row.brand })] })),
    },
    {
        key: 'total_calls',
        header: 'Calls',
        sortable: true,
        render: (row) => _jsx("span", { children: row.total_calls.toLocaleString() }),
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
        render: (row) => _jsx("span", { children: formatPercent(row.conversion_rate) }),
    },
    {
        key: 'avg_sentiment',
        header: 'Sentiment',
        sortable: true,
        render: (row) => {
            if (row.avg_sentiment === null)
                return _jsx("span", { className: "text-slate-400", children: "\u2014" });
            const v = row.avg_sentiment;
            const cls = v >= 0.3 ? 'text-emerald-600' : v <= -0.3 ? 'text-red-600' : 'text-amber-600';
            return _jsxs("span", { className: cls, children: [v >= 0 ? '+' : '', v.toFixed(2)] });
        },
    },
    {
        key: 'avg_call_score',
        header: 'Avg Score',
        sortable: true,
        render: (row) => _jsx("span", { children: row.avg_call_score !== null ? row.avg_call_score.toFixed(1) : '—' }),
    },
    {
        key: 'avg_call_duration',
        header: 'Avg Duration',
        sortable: true,
        render: (row) => _jsx("span", { children: formatDuration(row.avg_call_duration) }),
    },
];
export default function Dashboard() {
    const { dealerId } = useDealer();
    const { data, isLoading, isError, refetch } = useDashboard(dealerId);
    if (isError) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-80 gap-3 text-slate-500", children: [_jsx(AlertCircle, { size: 32, className: "text-red-400" }), _jsx("p", { children: "Failed to load dashboard data." }), _jsxs("button", { onClick: () => refetch(), className: "flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800", children: [_jsx(RefreshCw, { size: 14 }), " Retry"] })] }));
    }
    const kpis = data?.kpis;
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-slate-800", children: "Overview" }), _jsx("p", { className: "text-sm text-slate-500 mt-0.5", children: "BDC performance across all dealers" })] }), _jsx(SnowflakeFeatures, {}), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4", children: isLoading ? (Array.from({ length: 4 }).map((_, i) => (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5 h-28 animate-pulse", children: [_jsx("div", { className: "h-3 bg-slate-200 rounded w-24 mb-3" }), _jsx("div", { className: "h-7 bg-slate-200 rounded w-16 mb-3" })] }, i)))) : (_jsxs(_Fragment, { children: [_jsx(KPICard, { icon: Phone, label: "Total Calls", value: kpis?.total_calls.toLocaleString() ?? '—', iconColor: "text-blue-500" }), _jsx(KPICard, { icon: CalendarCheck, label: "Appointments Set", value: kpis?.appointments_set?.toLocaleString() ?? '—', iconColor: "text-violet-500" }), _jsx(KPICard, { icon: Smile, label: "Avg Sentiment", value: kpis?.avg_sentiment != null ? (kpis.avg_sentiment >= 0 ? '+' : '') + kpis.avg_sentiment.toFixed(2) : '—', iconColor: "text-emerald-500" }), _jsx(KPICard, { icon: Star, label: "Avg Call Score", value: kpis?.avg_call_score != null ? kpis.avg_call_score.toFixed(1) : '—', iconColor: "text-amber-500" })] })) }), _jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-700", children: "Dealer Breakdown" }), _jsx(DataTable, { columns: dealerColumns, data: data?.dealers ?? [], loading: isLoading, emptyMessage: "No dealer data found." })] })] }));
}
