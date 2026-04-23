import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { sendChatMessage, type ChatMessage, type CortexMetadata } from '@/api/agents'

interface Props {
  agentId: string
  agentName: string
}

function ChatMetadata({ meta }: { meta?: CortexMetadata }) {
  if (!meta || (!meta.model && !meta.latency_ms)) return null
  const parts: string[] = []
  if (meta.model) parts.push(meta.model)
  if (meta.input_tokens != null && meta.output_tokens != null) {
    let tok = `${meta.input_tokens + meta.output_tokens} tokens`
    if (meta.cache_read_tokens) tok += ` (${meta.cache_read_tokens} cached)`
    parts.push(tok)
  }
  if (meta.latency_ms != null) parts.push(`${(meta.latency_ms / 1000).toFixed(1)}s`)
  return (
    <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-emerald-400" />
      {parts.join(' · ')}
    </div>
  )
}

export default function CoachingChat({ agentId, agentName }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [statusSteps, setStatusSteps] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(scrollToBottom, [messages, scrollToBottom])

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = [...messages]
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStatusSteps([])

    // Add placeholder assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const meta = await sendChatMessage(
        agentId,
        text,
        history,
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + chunk }
            }
            return updated
          })
        },
        (status) => setStatusSteps((prev) => {
          if (prev.length > 0 && prev[prev.length - 1] === status) return prev
          return [...prev, status]
        }),
      )
      // Attach metadata to the completed assistant message
      if (meta) {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, metadata: meta }
          }
          return updated
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response. Please try again.'
      console.error('[Chat] Error:', errorMsg)
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: last.content || `⚠ ${errorMsg}`,
          }
        }
        return updated
      })
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col h-96 bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <Bot size={16} className="text-blue-500" />
        <span className="text-sm font-semibold text-slate-700">AI Coaching Chat</span>
        <span className="text-xs text-slate-400">Ask about {agentName}'s performance</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
            <Bot size={24} />
            <p>Ask a question about {agentName}'s performance.</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[
                'What should this agent focus on?',
                'How is their objection handling?',
                'Compare their greeting scores',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={13} className="text-blue-600" />
              </div>
            )}
            <div className="max-w-[80%]">
              <div
                className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                }`}
              >
                {msg.content ? (
                  msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-slate max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )
                ) : (
                  <div className="space-y-1">
                    {statusSteps.map((step, si) => (
                      <div key={si} className="flex items-center gap-1.5 text-slate-400 text-xs">
                        {si < statusSteps.length - 1 ? (
                          <span className="text-emerald-500">✓</span>
                        ) : (
                          <Loader2 size={10} className="animate-spin shrink-0" />
                        )}
                        <span>{step}</span>
                      </div>
                    ))}
                    {statusSteps.length === 0 && (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Loader2 size={12} className="animate-spin" /> Thinking...
                      </span>
                    )}
                  </div>
                )}
              </div>
              {msg.role === 'assistant' && msg.content && <ChatMetadata meta={msg.metadata} />}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <User size={13} className="text-slate-500" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask about ${agentName}...`}
            disabled={streaming}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
