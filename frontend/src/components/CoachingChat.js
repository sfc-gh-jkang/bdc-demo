import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendChatMessage } from '@/api/agents';
function ChatMetadata({ meta }) {
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
export default function CoachingChat({ agentId, agentName }) {
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
    async function handleSend() {
        const text = input.trim();
        if (!text || streaming)
            return;
        const userMsg = { role: 'user', content: text };
        const history = [...messages];
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setStreaming(true);
        setStatusSteps([]);
        // Add placeholder assistant message
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
        try {
            const meta = await sendChatMessage(agentId, text, history, (chunk) => {
                setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === 'assistant') {
                        updated[updated.length - 1] = { ...last, content: last.content + chunk };
                    }
                    return updated;
                });
            }, (status) => setStatusSteps((prev) => {
                if (prev.length > 0 && prev[prev.length - 1] === status)
                    return prev;
                return [...prev, status];
            }));
            // Attach metadata to the completed assistant message
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
            const errorMsg = err instanceof Error ? err.message : 'Failed to get response. Please try again.';
            console.error('[Chat] Error:', errorMsg);
            setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                        ...last,
                        content: last.content || `⚠ ${errorMsg}`,
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
    return (_jsxs("div", { className: "flex flex-col h-96 bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50", children: [_jsx(Bot, { size: 16, className: "text-blue-500" }), _jsx("span", { className: "text-sm font-semibold text-slate-700", children: "AI Coaching Chat" }), _jsxs("span", { className: "text-xs text-slate-400", children: ["Ask about ", agentName, "'s performance"] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-3 space-y-3", children: [messages.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2", children: [_jsx(Bot, { size: 24 }), _jsxs("p", { children: ["Ask a question about ", agentName, "'s performance."] }), _jsx("div", { className: "flex flex-wrap gap-1.5 mt-1", children: [
                                    'What should this agent focus on?',
                                    'How is their objection handling?',
                                    'Compare their greeting scores',
                                ].map((q) => (_jsx("button", { onClick: () => { setInput(q); inputRef.current?.focus(); }, className: "px-2.5 py-1 text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-colors", children: q }, q))) })] })), messages.map((msg, i) => (_jsxs("div", { className: `flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`, children: [msg.role === 'assistant' && (_jsx("div", { className: "w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5", children: _jsx(Bot, { size: 13, className: "text-blue-600" }) })), _jsxs("div", { className: "max-w-[80%]", children: [_jsx("div", { className: `px-3 py-2 rounded-xl text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-sm'
                                            : 'bg-slate-100 text-slate-700 rounded-bl-sm'}`, children: msg.content ? (msg.role === 'assistant' ? (_jsx("div", { className: "prose prose-sm prose-slate max-w-none", children: _jsx(ReactMarkdown, { children: msg.content }) })) : (_jsx("span", { className: "whitespace-pre-wrap", children: msg.content }))) : (_jsxs("div", { className: "space-y-1", children: [statusSteps.map((step, si) => (_jsxs("div", { className: "flex items-center gap-1.5 text-slate-400 text-xs", children: [si < statusSteps.length - 1 ? (_jsx("span", { className: "text-emerald-500", children: "\u2713" })) : (_jsx(Loader2, { size: 10, className: "animate-spin shrink-0" })), _jsx("span", { children: step })] }, si))), statusSteps.length === 0 && (_jsxs("span", { className: "inline-flex items-center gap-1 text-slate-400", children: [_jsx(Loader2, { size: 12, className: "animate-spin" }), " Thinking..."] }))] })) }), msg.role === 'assistant' && msg.content && _jsx(ChatMetadata, { meta: msg.metadata })] }), msg.role === 'user' && (_jsx("div", { className: "w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5", children: _jsx(User, { size: 13, className: "text-slate-500" }) }))] }, i))), _jsx("div", { ref: bottomRef })] }), _jsx("div", { className: "px-4 py-3 border-t border-slate-200 bg-white", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { ref: inputRef, type: "text", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSend(), placeholder: `Ask about ${agentName}...`, disabled: streaming, className: "flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" }), _jsx("button", { onClick: handleSend, disabled: !input.trim() || streaming, className: "p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: streaming ? _jsx(Loader2, { size: 16, className: "animate-spin" }) : _jsx(Send, { size: 16 }) })] }) })] }));
}
