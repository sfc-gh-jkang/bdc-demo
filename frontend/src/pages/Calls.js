import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useDealer } from '@/context/DealerContext';
import { useCalls } from '@/api/calls';
import { useAgents } from '@/api/agents';
import DataTable from '@/components/DataTable';
import SentimentBadge from '@/components/SentimentBadge';
const DISPOSITIONS = [
    'appointment_set',
    'voicemail',
    'no_answer',
    'callback_requested',
    'information_provided',
    'complaint',
    'wrong_number',
    'do_not_call',
];
function formatDate(s) {
    return new Date(s).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}
function formatDuration(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}
const columns = [
    {
        key: 'call_date',
        header: 'Date',
        sortable: true,
        render: (row) => _jsx("span", { className: "text-slate-600", children: formatDate(row.call_date) }),
    },
    {
        key: 'agent_name',
        header: 'Agent',
        sortable: true,
        render: (row) => _jsx("span", { className: "font-medium text-slate-800", children: row.agent_name }),
    },
    {
        key: 'direction',
        header: 'Direction',
        sortable: true,
        render: (row) => (_jsx("span", { className: "px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs capitalize", children: row.direction ?? '—' })),
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
        render: (row) => (_jsx("span", { className: "px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs", children: row.disposition })),
    },
    {
        key: 'sentiment_score',
        header: 'Sentiment',
        sortable: true,
        render: (row) => row.sentiment_score !== null
            ? _jsx(SentimentBadge, { score: row.sentiment_score })
            : _jsx("span", { className: "text-slate-400", children: "\u2014" }),
    },
    {
        key: 'dealer_name',
        header: 'Dealer',
        sortable: true,
    },
];
const PAGE_SIZE = 50;
export default function Calls() {
    const [searchParams] = useSearchParams();
    const { dealerId } = useDealer();
    const navigate = useNavigate();
    const { data: agents } = useAgents(dealerId);
    const [offset, setOffset] = useState(0);
    const [agentId, setAgentId] = useState(searchParams.get('agent_id') ?? '');
    const [disposition, setDisposition] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const filters = {
        dealer_id: dealerId,
        agent_id: agentId || null,
        disposition: disposition || null,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        limit: PAGE_SIZE,
        offset,
    };
    const { data, isLoading, isError, refetch } = useCalls(filters);
    const calls = data?.calls ?? [];
    const hasMore = calls.length === PAGE_SIZE;
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    if (isError) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-80 gap-3 text-slate-500", children: [_jsx(AlertCircle, { size: 32, className: "text-red-400" }), _jsx("p", { children: "Failed to load calls." }), _jsxs("button", { onClick: () => refetch(), className: "flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800", children: [_jsx(RefreshCw, { size: 14 }), " Retry"] })] }));
    }
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-slate-800", children: "Call Log" }), _jsx("p", { className: "text-sm text-slate-500 mt-0.5", children: "Browse and filter call records" })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3", children: [_jsx(Filter, { size: 16, className: "text-slate-400 self-end mb-1" }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs text-slate-500 font-medium", children: "Agent" }), _jsxs("select", { value: agentId, onChange: (e) => { setAgentId(e.target.value); setOffset(0); }, className: "text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44", children: [_jsx("option", { value: "", children: "All Agents" }), (agents ?? []).map((a) => (_jsx("option", { value: a.agent_id, children: a.agent_name }, a.agent_id)))] })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs text-slate-500 font-medium", children: "Disposition" }), _jsxs("select", { value: disposition, onChange: (e) => { setDisposition(e.target.value); setOffset(0); }, className: "text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44", children: [_jsx("option", { value: "", children: "All Dispositions" }), DISPOSITIONS.map((d) => (_jsx("option", { value: d, children: d.replace(/_/g, ' ') }, d)))] })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs text-slate-500 font-medium", children: "From" }), _jsx("input", { type: "date", value: dateFrom, onChange: (e) => { setDateFrom(e.target.value); setOffset(0); }, className: "text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs text-slate-500 font-medium", children: "To" }), _jsx("input", { type: "date", value: dateTo, onChange: (e) => { setDateTo(e.target.value); setOffset(0); }, className: "text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsx("button", { onClick: () => { setAgentId(''); setDisposition(''); setDateFrom(''); setDateTo(''); setOffset(0); }, className: "text-sm text-slate-500 hover:text-slate-700 underline self-end pb-1.5", children: "Clear" })] }), _jsx(DataTable, { columns: columns, data: calls, loading: isLoading, onRowClick: (row) => navigate(`/calls/${row.call_id}`), emptyMessage: "No calls match the current filters." }), _jsxs("div", { className: "flex items-center justify-between text-sm text-slate-600", children: [_jsxs("span", { children: ["Page ", page, " \u00B7 Showing ", calls.length, " results"] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => setOffset((o) => Math.max(0, o - PAGE_SIZE)), disabled: offset === 0, className: "p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed", children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("button", { onClick: () => setOffset((o) => o + PAGE_SIZE), disabled: !hasMore, className: "p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed", children: _jsx(ChevronRight, { size: 16 }) })] })] })] }));
}
