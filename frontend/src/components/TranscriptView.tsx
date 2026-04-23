import SentimentBadge from './SentimentBadge'
import { AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react'
import type { TranscriptTurn } from '@/api/calls'

function formatOffset(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface TranscriptViewProps {
  transcript: TranscriptTurn[]
  callSummary: string | null
  sentimentScore: number | null
  sentimentLabel: string | null
  disposition: string
  followUpAction: string | null
  customerObjections: string | null
}

export default function TranscriptView({
  transcript,
  callSummary,
  sentimentScore,
  sentimentLabel,
  disposition,
  followUpAction,
  customerObjections,
}: TranscriptViewProps) {
  return (
    <div className="flex gap-6 items-start">
      {/* Transcript */}
      <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
        {transcript.map((turn, i) => {
          const isAgent = turn.speaker === 'agent'
          return (
            <div key={i} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isAgent ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                <div className="flex items-center gap-2">
                  {!isAgent && (
                    <span className="text-xs text-slate-400 font-medium">{turn.speaker_name}</span>
                  )}
                  <span className="text-xs text-slate-400">{formatOffset(turn.offset_seconds)}</span>
                  {isAgent && (
                    <span className="text-xs text-slate-400 font-medium">{turn.speaker_name}</span>
                  )}
                </div>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isAgent
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                  }`}
                >
                  {turn.text}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Analysis sidebar */}
      <div className="w-72 shrink-0 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <MessageSquare size={15} className="text-blue-500" />
            AI Analysis
          </h3>

          {sentimentScore !== null && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Sentiment</p>
              <div className="flex items-center gap-2">
                <SentimentBadge score={sentimentScore} />
                {sentimentLabel && (
                  <span className="text-xs text-slate-500">{sentimentLabel}</span>
                )}
              </div>
            </div>
          )}

          {callSummary && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Summary</p>
              <p className="text-xs text-slate-600 leading-relaxed">{callSummary}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Disposition</p>
            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
              {disposition}
            </span>
          </div>

          {followUpAction && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1 flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-500" /> Follow-up
              </p>
              <p className="text-xs text-slate-600">{followUpAction}</p>
            </div>
          )}

          {customerObjections && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <AlertCircle size={11} className="text-amber-500" /> Customer Objections
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">{customerObjections}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
