import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, User, Phone, CalendarDays, AlertCircle, RefreshCw } from 'lucide-react';
import { useCallDetail } from '@/api/calls';
import TranscriptView from '@/components/TranscriptView';
import SentimentBadge from '@/components/SentimentBadge';
function formatDate(s) {
    return new Date(s).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
function formatDuration(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
}
function MetaChip({ icon: Icon, label, value }) {
    return (_jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx(Icon, { size: 15, className: "text-slate-400" }), _jsxs("span", { className: "text-slate-400", children: [label, ":"] }), _jsx("span", { className: "text-slate-700 font-medium", children: value })] }));
}
function ScoreRow({ label, value }) {
    if (value === null || value === undefined)
        return null;
    const pct = Math.min(100, Math.max(0, value));
    return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-xs text-slate-500 w-32 shrink-0", children: label }), _jsx("div", { className: "flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-blue-500", style: { width: `${pct}%` } }) }), _jsx("span", { className: "text-xs text-slate-600 w-8 text-right", children: value.toFixed(0) })] }));
}
export default function CallDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, isLoading, isError, refetch } = useCallDetail(id);
    if (isLoading) {
        return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("div", { className: "h-6 w-32 bg-slate-200 rounded animate-pulse" }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-5 space-y-3", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "h-4 bg-slate-100 rounded animate-pulse", style: { width: `${60 + i * 10}%` } }, i))) }), _jsx("div", { className: "h-96 bg-white rounded-xl border border-slate-200 animate-pulse" })] }));
    }
    if (isError || !data) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-80 gap-3 text-slate-500", children: [_jsx(AlertCircle, { size: 32, className: "text-red-400" }), _jsx("p", { children: "Call not found or failed to load." }), _jsxs("button", { onClick: () => refetch(), className: "flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800", children: [_jsx(RefreshCw, { size: 14 }), " Retry"] })] }));
    }
    return (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("button", { onClick: () => navigate(-1), className: "flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors", children: [_jsx(ArrowLeft, { size: 15 }), " Back"] }), _jsx("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: _jsxs("div", { className: "flex items-start justify-between flex-wrap gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-lg font-bold text-slate-800", children: "Call Detail" }), _jsxs("div", { className: "flex flex-wrap gap-x-6 gap-y-1.5", children: [_jsx(MetaChip, { icon: User, label: "Agent", value: data.agent_name }), _jsx(MetaChip, { icon: Phone, label: "Customer", value: data.customer_name }), _jsx(MetaChip, { icon: CalendarDays, label: "Date", value: formatDate(data.call_datetime ?? data.call_date) }), _jsx(MetaChip, { icon: Clock, label: "Duration", value: formatDuration(data.duration_seconds) }), _jsx(MetaChip, { icon: Phone, label: "Dealer", value: data.dealer_name })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [data.direction && (_jsx("span", { className: "px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs capitalize", children: data.direction })), _jsx("span", { className: "px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium", children: data.disposition }), data.sentiment_score !== null && (_jsx(SentimentBadge, { score: data.sentiment_score }))] })] }) }), data.scores && (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-700 mb-4", children: "Coaching Scores" }), _jsxs("div", { className: "space-y-2.5 max-w-lg", children: [_jsx(ScoreRow, { label: "Greeting", value: data.scores.greeting }), _jsx(ScoreRow, { label: "Active Listening", value: data.scores.active_listening }), _jsx(ScoreRow, { label: "Objection Handling", value: data.scores.objection_handling }), _jsx(ScoreRow, { label: "Product Knowledge", value: data.scores.product_knowledge }), _jsx(ScoreRow, { label: "Closing", value: data.scores.closing }), _jsx(ScoreRow, { label: "Professionalism", value: data.scores.professionalism }), _jsx(ScoreRow, { label: "Overall Score", value: data.scores.overall_score })] })] })), _jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-700 mb-4", children: "Transcript" }), _jsx(TranscriptView, { transcript: data.transcript, callSummary: data.call_summary, sentimentScore: data.sentiment_score, sentimentLabel: data.sentiment_label, disposition: data.disposition, followUpAction: data.follow_up_action, customerObjections: data.customer_objections })] })] }));
}
