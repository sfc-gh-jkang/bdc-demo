import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useDealer } from '@/context/DealerContext';
import { useLeaderboard } from '@/api/leaderboard';
import DataTable from '@/components/DataTable';
import SentimentBadge from '@/components/SentimentBadge';
function ScoreBar({ score }) {
    const pct = Math.min(100, Math.max(0, score));
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-24", children: _jsx("div", { className: "h-full rounded-full bg-blue-500", style: { width: `${pct}%` } }) }), _jsx("span", { className: "text-xs text-slate-600 w-8 text-right", children: score.toFixed(0) })] }));
}
const columns = [
    {
        key: 'rank',
        header: 'Rank',
        sortable: true,
        className: 'w-16',
        render: (row) => (_jsx("span", { className: "inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold", children: row.rank })),
    },
    {
        key: 'agent_name',
        header: 'Agent',
        sortable: true,
        render: (row) => (_jsx("span", { className: "font-medium text-slate-800", children: row.agent_name })),
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
        render: (row) => (_jsx("span", { className: "px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs", children: row.skill_tier })),
    },
    {
        key: 'composite_score',
        header: 'Score',
        sortable: true,
        render: (row) => _jsx(ScoreBar, { score: row.composite_score ?? 0 }),
    },
    {
        key: 'avg_sentiment',
        header: 'Sentiment',
        sortable: true,
        render: (row) => row.avg_sentiment !== null ? _jsx(SentimentBadge, { score: row.avg_sentiment }) : _jsx("span", { className: "text-slate-400", children: "\u2014" }),
    },
    {
        key: 'appointments_set',
        header: 'Appts',
        sortable: true,
        render: (row) => (_jsx("span", { className: "text-slate-700", children: row.appointments_set })),
    },
    {
        key: 'total_calls',
        header: 'Calls',
        sortable: true,
        render: (row) => (_jsx("span", { className: "text-slate-700", children: row.total_calls.toLocaleString() })),
    },
];
export default function Leaderboard() {
    const { dealerId } = useDealer();
    const { data, isLoading, isError, refetch } = useLeaderboard(dealerId);
    const navigate = useNavigate();
    if (isError) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-80 gap-3 text-slate-500", children: [_jsx(AlertCircle, { size: 32, className: "text-red-400" }), _jsx("p", { children: "Failed to load leaderboard." }), _jsxs("button", { onClick: () => refetch(), className: "flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800", children: [_jsx(RefreshCw, { size: 14 }), " Retry"] })] }));
    }
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-slate-800", children: "Agent Leaderboard" }), _jsx("p", { className: "text-sm text-slate-500 mt-0.5", children: "Ranked by composite coaching score" })] }), _jsx(DataTable, { columns: columns, data: data ?? [], loading: isLoading, onRowClick: (row) => navigate(`/agents/${row.agent_id}`), emptyMessage: "No agents found for this dealer." })] }));
}
