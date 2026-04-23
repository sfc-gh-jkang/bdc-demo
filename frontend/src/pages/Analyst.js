import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, MessageSquare, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { streamAnalystQuery } from '@/api/analyst';
const SAMPLE_QUESTIONS = [
    'Which agent set the most appointments last week?',
    'What is the average call score by dealer?',
    'Show me the appointment rate trend by day',
    'Which dealer has the highest conversion rate?',
    'How many calls were made per disposition type?',
    'Who are the top 5 agents by composite score?',
];
function MetadataBadge({ meta }) {
    if (!meta || (!meta.model && !meta.latency_ms))
        return null;
    const parts = [];
    if (meta.model)
        parts.push(meta.model);
    if (meta.input_tokens != null && meta.output_tokens != null) {
        let tok = `${meta.input_tokens + meta.output_tokens} tokens`;
        if (meta.cache_read_tokens)
            tok += ` (${meta.cache_read_tokens} cached)`;
        parts.push(tok);
    }
    if (meta.latency_ms != null)
        parts.push(`${(meta.latency_ms / 1000).toFixed(1)}s`);
    return (_jsxs("div", { className: "mt-1 text-[10px] text-slate-400 flex items-center gap-1", children: [_jsx("span", { className: "inline-block w-1 h-1 rounded-full bg-emerald-400" }), parts.join(' · ')] }));
}
export default function Analyst() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [statusSteps, setStatusSteps] = useState([]);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const scrollToBottom = useCallback(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);
    useEffect(scrollToBottom, [messages, scrollToBottom]);
    async function handleSubmit(q) {
        const text = q ?? input.trim();
        if (!text || streaming)
            return;
        setInput('');
        setStreaming(true);
        setStatusSteps([]);
        // Add user message + empty assistant placeholder
        setMessages((prev) => [
            ...prev,
            { role: 'user', content: text },
            { role: 'assistant', content: '' },
        ]);
        try {
            const meta = await streamAnalystQuery(text, (chunk) => {
                setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === 'assistant') {
                        updated[updated.length - 1] = { ...last, content: last.content + chunk };
                    }
                    return updated;
                });
            }, (status) => setStatusSteps((prev) => {
                // Avoid duplicate consecutive steps
                if (prev.length > 0 && prev[prev.length - 1] === status)
                    return prev;
                return [...prev, status];
            }));
            // Attach metadata to the completed message
            if (meta) {
                setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === 'assistant') {
                        updated[updated.length - 1] = { ...last, metadata: meta };
                    }
                    return updated;
                });
            }
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to get response.';
            setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                        ...last,
                        content: last.content || `Error: ${errorMsg}`,
                    };
                }
                return updated;
            });
        }
        finally {
            setStreaming(false);
            inputRef.current?.focus();
        }
    }
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-200 bg-white shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Bot, { size: 20, className: "text-violet-500" }), _jsx("h2", { className: "text-lg font-semibold text-slate-800", children: "Cortex Agent" })] }), _jsx("p", { className: "text-sm text-slate-500 mt-0.5", children: "Ask questions about your BDC data in plain English \u2014 powered by COACHING_AGENT" })] }), _jsxs("div", { className: "flex-1 overflow-auto px-6 py-4 space-y-4", children: [messages.length === 0 && !streaming && (_jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center", children: [_jsx(MessageSquare, { size: 40, className: "text-slate-300 mb-3" }), _jsx("p", { className: "text-slate-500 text-sm mb-4", children: "Ask a question about calls, agents, or dealer performance" }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full", children: SAMPLE_QUESTIONS.map((q) => (_jsx("button", { onClick: () => handleSubmit(q), className: "text-left text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors", children: q }, q))) })] })), messages.map((msg, i) => (_jsxs("div", { className: `flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`, children: [msg.role === 'assistant' && (_jsx("div", { className: "w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5", children: _jsx(Bot, { size: 14, className: "text-violet-600" }) })), _jsxs("div", { className: "max-w-[80%]", children: [_jsx("div", { className: `px-4 py-2.5 rounded-xl text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-sm'
                                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`, style: msg.role === 'assistant' ? { boxShadow: 'var(--card-shadow)' } : undefined, children: msg.content ? (msg.role === 'assistant' ? (_jsx("div", { className: "prose prose-sm prose-slate max-w-none", children: _jsx(ReactMarkdown, { children: msg.content }) })) : (_jsx("span", { className: "whitespace-pre-wrap", children: msg.content }))) : (_jsxs("div", { className: "space-y-1", children: [statusSteps.map((step, si) => (_jsxs("div", { className: "flex items-center gap-1.5 text-slate-400 text-xs", children: [si < statusSteps.length - 1 ? (_jsx("span", { className: "text-emerald-500", children: "\u2713" })) : (_jsx(Loader2, { size: 10, className: "animate-spin shrink-0" })), _jsx("span", { children: step })] }, si))), statusSteps.length === 0 && (_jsxs("span", { className: "inline-flex items-center gap-1.5 text-slate-400", children: [_jsx(Loader2, { size: 12, className: "animate-spin" }), " Thinking..."] }))] })) }), msg.role === 'assistant' && msg.content && _jsx(MetadataBadge, { meta: msg.metadata })] })] }, i))), _jsx("div", { ref: bottomRef })] }), _jsx("div", { className: "px-6 py-3 border-t border-slate-200 bg-white shrink-0", children: _jsxs("div", { className: "flex gap-2 max-w-3xl mx-auto", children: [_jsx("input", { ref: inputRef, type: "text", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSubmit(), placeholder: "Ask about your BDC data...", disabled: streaming, className: "flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" }), _jsx("button", { onClick: () => handleSubmit(), disabled: !input.trim() || streaming, className: "px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed", children: streaming ? _jsx(Loader2, { size: 16, className: "animate-spin" }) : _jsx(Send, { size: 16 }) })] }) })] }));
}
