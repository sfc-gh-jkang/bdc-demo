import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, User, Phone, CalendarDays, Trophy, Star, AlertCircle, RefreshCw, Sparkles, Loader2, } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAgent, streamAgentSummary } from '@/api/agents';
import DataTable from '@/components/DataTable';
import SentimentBadge from '@/components/SentimentBadge';
import CoachingChat from '@/components/CoachingChat';
function formatDate(s) {
    if (!s)
        return '—';
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function StatCard({ label, value, icon: Icon }) {
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-400 mb-1", children: [_jsx(Icon, { size: 14 }), _jsx("span", { className: "text-xs font-medium uppercase tracking-wide", children: label })] }), _jsx("p", { className: "text-2xl font-bold text-slate-800", children: value })] }));
}
function ScoreBar({ score }) {
    const pct = Math.min(100, Math.max(0, score));
    const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-16", children: _jsx("div", { className: `h-full rounded-full ${color}`, style: { width: `${pct}%` } }) }), _jsx("span", { className: "text-xs text-slate-600 w-8 text-right", children: score.toFixed(0) })] }));
}
function MetadataPill({ meta }) {
    if (!meta || (!meta.model && !meta.latency_ms))
        return null;
    const parts = [];
    if (meta.model)
        parts.push(meta.model);
    if (meta.input_tokens != null && meta.output_tokens != null) {
        let tok = `${meta.input_tokens} in / ${meta.output_tokens} out tokens`;
        if (meta.cache_read_tokens)
            tok += ` (${meta.cache_read_tokens} cached)`;
        parts.push(tok);
    }
    if (meta.latency_ms != null)
        parts.push(`${(meta.latency_ms / 1000).toFixed(1)}s`);
    return (_jsxs("div", { className: "mt-2 text-[11px] text-slate-400 flex items-center gap-1.5", children: [_jsx("span", { className: "inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" }), parts.join(' · ')] }));
}
const callColumns = [
    {
        key: 'call_date',
        header: 'Date',
        sortable: true,
        render: (row) => _jsx("span", { className: "text-slate-600", children: formatDate(row.call_date) }),
    },
    {
        key: 'disposition',
        header: 'Disposition',
        render: (row) => (_jsx("span", { className: "px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs capitalize", children: row.disposition?.replace(/_/g, ' ') })),
    },
    {
        key: 'duration_seconds',
        header: 'Duration',
        sortable: true,
        render: (row) => (_jsxs("span", { className: "text-slate-600", children: [Math.floor(row.duration_seconds / 60), "m ", row.duration_seconds % 60, "s"] })),
    },
    {
        key: 'overall_score',
        header: 'Score',
        sortable: true,
        render: (row) => row.overall_score != null ? _jsx(ScoreBar, { score: row.overall_score }) : _jsx("span", { className: "text-slate-400", children: "\u2014" }),
    },
    {
        key: 'sentiment_score',
        header: 'Sentiment',
        sortable: true,
        render: (row) => row.sentiment_score != null ? _jsx(SentimentBadge, { score: row.sentiment_score }) : _jsx("span", { className: "text-slate-400", children: "\u2014" }),
    },
];
export default function AgentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, isLoading, isError, refetch } = useAgent(id);
    // Streaming summary state
    const [summaryText, setSummaryText] = useState('');
    const [summaryMeta, setSummaryMeta] = useState();
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summarySteps, setSummarySteps] = useState([]);
    const [summaryLoaded, setSummaryLoaded] = useState(false);
    const loadSummary = useCallback(async (agentId) => {
        setSummaryText('');
        setSummaryMeta(undefined);
        setSummaryLoading(true);
        setSummarySteps([]);
        try {
            const meta = await streamAgentSummary(agentId, (chunk) => setSummaryText((prev) => prev + chunk), (status) => setSummarySteps((prev) => {
                if (prev.length > 0 && prev[prev.length - 1] === status)
                    return prev;
                return [...prev, status];
            }));
            setSummaryMeta(meta);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to generate summary';
            setSummaryText((prev) => prev || `Error: ${msg}`);
        }
        finally {
            setSummaryLoading(false);
            setSummaryLoaded(true);
        }
    }, []);
    // Auto-load summary when agent data loads
    useEffect(() => {
        if (data?.agent_id && !summaryLoaded && !summaryLoading) {
            loadSummary(data.agent_id);
        }
    }, [data?.agent_id, summaryLoaded, summaryLoading, loadSummary]);
    if (isLoading) {
        return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("div", { className: "h-6 w-32 bg-slate-200 rounded animate-pulse" }), _jsx("div", { className: "grid grid-cols-4 gap-4", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "h-24 bg-white rounded-xl border border-slate-200 animate-pulse" }, i))) }), _jsx("div", { className: "h-64 bg-white rounded-xl border border-slate-200 animate-pulse" })] }));
    }
    if (isError || !data) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-80 gap-3 text-slate-500", children: [_jsx(AlertCircle, { size: 32, className: "text-red-400" }), _jsx("p", { children: "Agent not found or failed to load." }), _jsxs("button", { onClick: () => refetch(), className: "flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800", children: [_jsx(RefreshCw, { size: 14 }), " Retry"] })] }));
    }
    const m = data.metrics;
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("button", { onClick: () => navigate(-1), className: "flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors", children: [_jsx(ArrowLeft, { size: 15 }), " Back"] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: _jsxs("div", { className: "flex items-start justify-between flex-wrap gap-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center", children: _jsx(User, { size: 24, className: "text-blue-600" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-slate-800", children: data.agent_name }), _jsx("div", { className: "flex items-center gap-4 mt-1 text-sm text-slate-500", children: _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Phone, { size: 13 }), " ", data.dealer_name] }) })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: "px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium capitalize", children: [data.skill_tier, " tier"] }), m.rank && (_jsxs("span", { className: "flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium", children: [_jsx(Trophy, { size: 13 }), " Rank #", m.rank] }))] })] }) }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsx(StatCard, { icon: Phone, label: "Total Calls", value: m.total_calls.toLocaleString() }), _jsx(StatCard, { icon: CalendarDays, label: "Appointments", value: m.appointments_set }), _jsx(StatCard, { icon: Star, label: "Avg Score", value: m.avg_score?.toFixed(1) ?? '—' }), _jsx(StatCard, { icon: Trophy, label: "Composite", value: m.composite_score?.toFixed(1) ?? '—' })] }), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sparkles, { size: 16, className: "text-blue-500" }), _jsx("h3", { className: "text-sm font-semibold text-slate-700", children: "AI Coaching Summary" }), _jsx("span", { className: "text-xs text-slate-400", children: "Powered by Snowflake Cortex" })] }), _jsxs("button", { onClick: () => data && loadSummary(data.agent_id), disabled: summaryLoading, className: "flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50", children: [summaryLoading ? _jsx(Loader2, { size: 12, className: "animate-spin" }) : _jsx(RefreshCw, { size: 12 }), "Regenerate"] })] }), summaryLoading && !summaryText ? (_jsxs("div", { className: "space-y-1.5 py-1", children: [summarySteps.map((step, si) => (_jsxs("div", { className: "flex items-center gap-1.5 text-slate-400 text-xs", children: [si < summarySteps.length - 1 ? (_jsx("span", { className: "text-emerald-500", children: "\u2713" })) : (_jsx(Loader2, { size: 10, className: "animate-spin shrink-0" })), _jsx("span", { children: step })] }, si))), summarySteps.length === 0 && (_jsxs("div", { className: "flex items-center gap-1.5 text-slate-400 text-xs", children: [_jsx(Loader2, { size: 10, className: "animate-spin" }), " Thinking..."] }))] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "prose prose-sm prose-slate max-w-none", children: _jsx(ReactMarkdown, { children: summaryText || 'No summary available.' }) }), _jsx(MetadataPill, { meta: summaryMeta })] }))] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-slate-700 mb-3", children: "Recent Calls" }), _jsx(DataTable, { columns: callColumns, data: data.recent_calls, onRowClick: (row) => navigate(`/calls/${row.call_id}`), emptyMessage: "No recent calls found." })] }), _jsx(CoachingChat, { agentId: data.agent_id, agentName: data.agent_name })] }));
}
