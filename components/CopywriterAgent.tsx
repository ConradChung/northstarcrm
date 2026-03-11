'use client'

import { useState, useEffect } from 'react'
import { Wand2, Copy, Check, RotateCcw, Clock } from 'lucide-react'
import { saveRun, loadRuns, loadAllRuns, relativeTime, type AiRun } from '@/lib/ai-runs'

interface Client {
  id: string
  email: string
  company_name: string
}

interface Props {
  clients: Client[]
}

interface EmailStep {
  title: string
  subject: string
  body: string
  meta: string
}

const VARIANT_COLORS = ['#5E6AD2', '#7A5BD2', '#9E4FD2']
const SEQ_COLORS = ['#6AD2B0', '#D2906A']
const VARIANT_LABELS = ['Direct Offer', 'Industry Pain', 'Curiosity Hook']

const LABEL_COLORS = ['#5E6AD2', '#8B6AD2', '#6AD2B0', '#D2A06A', '#D26A6A', '#6AD2D2']
function clientColor(id: string) {
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}

function parseBlock(block: string): EmailStep {
  const lines = block.trim().split('\n')
  const titleLine = lines[0].replace(/^## EMAIL [^:]+:\s*/, '').trim()
  const subjectLine = lines.find(l => /^Subject:/i.test(l.trim()))
  const subject = subjectLine?.replace(/^Subject:\s*/i, '').trim() ?? ''
  const metaLine = lines.find(l => /^Words:/i.test(l.trim()))
  const meta = metaLine?.trim() ?? ''
  const bodyLines = lines.filter(l =>
    l !== lines[0] &&
    !/^Subject:/i.test(l.trim()) &&
    !/^Words:/i.test(l.trim()) &&
    !/^---/.test(l.trim())
  ).join('\n').trim()
  return { title: titleLine, subject, body: bodyLines, meta }
}

function parseOutput(raw: string): { variants: EmailStep[]; sequence: EmailStep[] } {
  const allBlocks = raw.split(/(?=## EMAIL )/g).filter(b => /^## EMAIL /.test(b.trim()))
  const variants: EmailStep[] = []
  const sequence: EmailStep[] = []
  for (const block of allBlocks) {
    const header = block.match(/^## EMAIL ([^\s:]+)/)?.[1] ?? ''
    if (/^1[ABC]$/i.test(header)) {
      variants.push(parseBlock(block))
    } else if (header === '2' || header === '3') {
      sequence.push(parseBlock(block))
    }
  }
  return { variants, sequence }
}

function EmailCard({ step, color, label, isStreaming }: {
  step: EmailStep; color: string; label: string; isStreaming: boolean
}) {
  const [copied, setCopied] = useState(false)
  const copyText = async () => {
    const text = [step.subject && `Subject: ${step.subject}`, step.body].filter(Boolean).join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex flex-col border border-[var(--border)] rounded-xl overflow-hidden min-h-[320px]">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-raised)] shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
            style={{ color, border: `1px solid ${color}33`, background: `${color}11` }}>{label}</span>
          {step.title && <span className="text-[12px] font-semibold text-[var(--text-primary)]">{step.title}</span>}
        </div>
        {step.body && (
          <button onClick={copyText} className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            {copied ? <Check size={12} className="text-[#2ECC71]" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      {step.subject && (
        <div className="px-5 pt-3.5 pb-2.5 border-b border-[var(--border-subtle)] shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-placeholder)] mb-1">Subject</p>
          <p className="text-[12px] text-[var(--text-secondary)] font-mono">{step.subject}</p>
        </div>
      )}
      <div className="flex-1 px-5 py-4">
        {step.body ? (
          <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{step.body}</p>
        ) : isStreaming ? (
          <span className="w-1.5 h-4 bg-[#5E6AD2] animate-pulse rounded-sm inline-block" />
        ) : null}
      </div>
      {step.meta && (
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] shrink-0">
          <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{step.meta}</p>
        </div>
      )}
    </div>
  )
}

function SkeletonCard({ label, color }: { label: string; color: string }) {
  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden min-h-[320px]">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-raised)]">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ color, border: `1px solid ${color}33`, background: `${color}11` }}>{label}</span>
      </div>
      <div className="px-5 py-4 flex items-start gap-1.5">
        <span className="w-1.5 h-4 bg-[#5E6AD2] animate-pulse rounded-sm mt-0.5" />
        <span className="text-[13px] text-[var(--text-placeholder)]">Writing...</span>
      </div>
    </div>
  )
}

function RunsHistory({ runs, onLoad, clients }: {
  runs: AiRun[]; onLoad: (run: AiRun) => void; clients: Client[]
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const clientName = (id: string) => clients.find(c => c.id === id)?.company_name || 'Unknown'
  const copyRun = async (run: AiRun) => {
    await navigator.clipboard.writeText(run.output)
    setCopiedId(run.id)
    setTimeout(() => setCopiedId(null), 2000)
  }
  if (!runs.length) return null
  return (
    <div className="mt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
        <Clock size={10} /> Previous runs
      </p>
      <div className="space-y-1">
        {runs.map(run => {
          const color = clientColor(run.client_id)
          return (
            <div key={run.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border)] transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[12px] text-[var(--text-secondary)] shrink-0 w-16">{relativeTime(run.created_at)}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                  style={{ color, background: `${color}18`, border: `1px solid ${color}33` }}>
                  {clientName(run.client_id)}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => onLoad(run)} className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Load</button>
                <button onClick={() => copyRun(run)} className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  {copiedId === run.id ? <Check size={11} className="text-[#2ECC71]" /> : <Copy size={11} />}
                  {copiedId === run.id ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CopywriterAgent({ clients }: Props) {
  const [clientId, setClientId] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedAll, setCopiedAll] = useState(false)
  const [runs, setRuns] = useState<AiRun[]>([])

  useEffect(() => { loadAllRuns('copywriter').then(setRuns) }, [])

  useEffect(() => {
    setOutput('')
    setError('')
    if (clientId) {
      loadRuns('copywriter', clientId).then(setRuns)
    } else {
      loadAllRuns('copywriter').then(setRuns)
    }
  }, [clientId])

  const generate = async () => {
    if (!clientId) return
    setLoading(true)
    setOutput('')
    setError('')
    const res = await fetch('/api/generate-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId }),
    })
    if (!res.ok) {
      setError(await res.text() || 'Failed to generate copy')
      setLoading(false)
      return
    }
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return
    let fullText = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fullText += decoder.decode(value)
      setOutput(fullText)
    }
    setLoading(false)
    if (fullText) {
      saveRun('copywriter', clientId, fullText)
        .then(() => loadRuns('copywriter', clientId).then(setRuns))
        .catch(console.error)
    }
  }

  const copyAll = async () => {
    await navigator.clipboard.writeText(output)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const inputCls = 'px-3 py-2 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border)]'
  const { variants, sequence } = output ? parseOutput(output) : { variants: [], sequence: [] }
  const hasContent = variants.length > 0 || sequence.length > 0
  const showSkeleton = loading && !hasContent

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls} style={{ minWidth: 200 }}>
          <option value="">Select a client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.company_name || c.email}</option>)}
        </select>

        <button onClick={generate} disabled={!clientId || loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-[var(--accent-fg)] text-[13px] font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? <span className="w-3.5 h-3.5 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin" /> : <Wand2 size={14} />}
          {loading ? 'Generating...' : 'Generate'}
        </button>
        {output && !loading && (
          <>
            <button onClick={generate} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-lg transition-colors" title="Regenerate">
              <RotateCcw size={14} />
            </button>
            <button onClick={copyAll} className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ml-1">
              {copiedAll ? <Check size={13} className="text-[#2ECC71]" /> : <Copy size={13} />}
              {copiedAll ? 'Copied all' : 'Copy all'}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-[13px] text-red-400">{error}</p>}

      {(hasContent || showSkeleton) && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Cold Outreach — 3 Angles</p>
            <div className="grid grid-cols-3 gap-5">
              {showSkeleton || variants.length === 0
                ? VARIANT_LABELS.map((label, i) => <SkeletonCard key={i} label={label} color={VARIANT_COLORS[i]} />)
                : variants.map((step, i) => (
                    <EmailCard key={i} step={step} color={VARIANT_COLORS[i] ?? VARIANT_COLORS[0]} label={VARIANT_LABELS[i] ?? `Angle ${i + 1}`} isStreaming={loading} />
                  ))}
            </div>
          </div>
          {(sequence.length > 0 || showSkeleton) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Sequence</p>
              <div className="grid grid-cols-2 gap-5">
                {showSkeleton || sequence.length === 0
                  ? ['Follow-Up', 'Final Touch'].map((label, i) => <SkeletonCard key={i} label={label} color={SEQ_COLORS[i]} />)
                  : sequence.map((step, i) => (
                      <EmailCard key={i} step={step} color={SEQ_COLORS[i] ?? SEQ_COLORS[0]} label={i === 0 ? 'Follow-Up' : 'Final Touch'} isStreaming={loading} />
                    ))}
              </div>
            </div>
          )}
        </div>
      )}

      <RunsHistory runs={runs} onLoad={run => setOutput(run.output)} clients={clients} />
    </div>
  )
}
