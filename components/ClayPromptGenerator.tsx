'use client'

import { useState, useEffect } from 'react'
import { Layers, Copy, Check, RotateCcw, Clock } from 'lucide-react'
import { saveRun, loadRuns, loadAllRuns, relativeTime, type AiRun } from '@/lib/ai-runs'

interface Client {
  id: string
  email: string
  company_name: string
}

interface ClayPrompt {
  id: string
  title: string
  description: string
  prompt: string
}

interface Props {
  clients: Client[]
}

// ── Colour helpers ──────────────────────────────────────────────────────────
const LABEL_COLORS = ['#5E6AD2', '#8B6AD2', '#6AD2B0', '#D2A06A', '#D26A6A', '#6AD2D2']
function clientColor(id: string) {
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}

// ── Static prompt templates ────────────────────────────────────────────────
type TemplateTab = 'multi' | 'single' | 'achievement' | 'linkedin-post' | 'google-reviews'

const ALL_TEMPLATES: Record<TemplateTab, ClayPrompt> = {
  multi: {
    id: 'loc-multi',
    title: 'Multiple Operating Areas',
    description: 'Finds 3 cities/regions this business serves — for email personalization.',
    prompt: `Based on {{website}}, identify 3 cities or service areas where this business operates. Write a short phrase for cold email personalization.

Output format: "serving [City1], [City2], and [City3]"
Max 12 words. No extra text, no explanation.`,
  },
  single: {
    id: 'loc-single',
    title: 'Single Operating Area',
    description: 'Finds the one main city/metro this business operates from.',
    prompt: `Based on {{website}}, identify the single primary city and state where this business is headquartered or mainly operates.

Write a short phrase for cold email personalization.
Output format: "based in [City, State]"
Max 6 words. No extra text, no explanation.`,
  },
  achievement: {
    id: 'achievement',
    title: 'Achievement Signal',
    description: 'Finds a recent growth signal, award, or milestone.',
    prompt: `Search for a recent news mention, award, expansion, or growth signal for the company at {{website}}.

Write one short sentence: "[Company] just [achievement]."
If nothing specific is found, return: "actively growing in their market"
No extra text.`,
  },
  'linkedin-post': {
    id: 'linkedin-post',
    title: 'LinkedIn Post Opener',
    description: 'Summarises their latest LinkedIn post as a conversation starter.',
    prompt: `Find the most recent LinkedIn post published by the company or founder at {{website}}.

Summarise it in one sentence that makes a natural conversation opener.
If no post is found, write a relevant industry insight this prospect would care about.
No preamble, no explanation.`,
  },
  'google-reviews': {
    id: 'google-reviews',
    title: 'Google Reviews',
    description: 'Returns review count and star rating for the business.',
    prompt: `Find the total number of Google Reviews and average star rating for the business at {{website}}.

Return format: "X reviews, Y★"
If it is an enterprise, SaaS, or B2B company without a local listing, return: "N/A — enterprise prospect"
No extra text.`,
  },
}

const TEMPLATE_TABS: { id: TemplateTab; label: string }[] = [
  { id: 'multi', label: 'Multiple Areas' },
  { id: 'single', label: 'Single Area' },
  { id: 'achievement', label: 'Achievement Signal' },
  { id: 'linkedin-post', label: 'LinkedIn Post' },
  { id: 'google-reviews', label: 'Google Reviews' },
]

// ── Runs history ──────────────────────────────────────────────────────────
function RunsHistory({ runs, onLoad, clients }: { runs: AiRun[]; onLoad: (run: AiRun) => void; clients: Client[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const clientName = (id: string) => clients.find(c => c.id === id)?.company_name || 'Unknown'

  const copyRun = async (run: AiRun) => {
    try {
      const parsed: ClayPrompt[] = JSON.parse(run.output)
      const all = parsed.map(p => `## ${p.title}\n${p.prompt}`).join('\n\n---\n\n')
      await navigator.clipboard.writeText(all)
    } catch {
      await navigator.clipboard.writeText(run.output)
    }
    setCopiedId(run.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!runs.length) return null
  return (
    <div className="mt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A] mb-2 flex items-center gap-1.5">
        <Clock size={10} /> Previous runs
      </p>
      <div className="space-y-1">
        {runs.map(run => {
          const color = clientColor(run.client_id)
          return (
            <div key={run.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#1A1A1A] hover:border-[#2A2A2A] transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[12px] text-[#5A5A5A] shrink-0 w-16">{relativeTime(run.created_at)}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                  style={{ color, background: `${color}18`, border: `1px solid ${color}33` }}>
                  {clientName(run.client_id)}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => onLoad(run)} className="text-[11px] text-[#5A5A5A] hover:text-white transition-colors">Load</button>
                <button onClick={() => copyRun(run)} className="flex items-center gap-1 text-[11px] text-[#5A5A5A] hover:text-white transition-colors">
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

// ── Main component ────────────────────────────────────────────────────────
export default function ClayPromptGenerator({ clients }: Props) {
  const [clientId, setClientId] = useState('')
  const [prompts, setPrompts] = useState<ClayPrompt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [runs, setRuns] = useState<AiRun[]>([])
  const [templateVariant, setTemplateVariant] = useState<TemplateTab>('multi')

  const inputCls = 'w-full px-3 py-2 bg-[#0F0F0F] border border-[#1E1E1E] rounded-lg text-[13px] text-white placeholder-[#4A4A4A] focus:outline-none focus:border-[#3A3A3A]'

  useEffect(() => {
    loadAllRuns('clay-prompts').then(setRuns)
  }, [])

  useEffect(() => {
    setPrompts([])
    setError('')
    if (clientId) {
      loadRuns('clay-prompts', clientId).then(setRuns)
    } else {
      loadAllRuns('clay-prompts').then(setRuns)
    }
  }, [clientId])

  const generate = async () => {
    if (!clientId) return
    setLoading(true)
    setPrompts([])
    setError('')

    const res = await fetch('/api/generate-clay-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId }),
    })

    if (!res.ok) {
      setError(await res.text() || 'Failed to generate prompts')
      setLoading(false)
      return
    }

    const data = await res.json()
    const newPrompts: ClayPrompt[] = data.prompts || []
    setPrompts(newPrompts)
    setLoading(false)

    if (newPrompts.length) {
      saveRun('clay-prompts', clientId, JSON.stringify(newPrompts))
        .then(() => loadRuns('clay-prompts', clientId).then(setRuns))
        .catch(console.error)
    }
  }

  const copyPrompt = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyAll = async () => {
    const all = prompts.map(p => `## ${p.title}\n${p.prompt}`).join('\n\n---\n\n')
    await navigator.clipboard.writeText(all)
    setCopied('all')
    setTimeout(() => setCopied(null), 2000)
  }

  const copyAllTemplates = async () => {
    const all = Object.values(ALL_TEMPLATES).map(p => `## ${p.title}\n${p.prompt}`).join('\n\n---\n\n')
    await navigator.clipboard.writeText(all)
    setCopied('tmpl-all')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div style={{ minWidth: 200, maxWidth: 280 }}>
          <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
            <option value="">Select a client</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.company_name || c.email}</option>
            ))}
          </select>
        </div>
        <button
          onClick={generate}
          disabled={!clientId || loading}
          className="flex items-center gap-2 px-4 py-2 bg-white text-[#0A0A0A] text-[13px] font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin" />
          ) : (
            <Layers size={14} />
          )}
          {loading ? 'Generating...' : 'Generate from ICP'}
        </button>
        {prompts.length > 0 && (
          <button onClick={generate} className="p-2 text-[#5A5A5A] hover:text-white border border-[#1E1E1E] rounded-lg transition-colors" title="Regenerate">
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {error && <p className="text-[13px] text-red-400">{error}</p>}

      {loading && prompts.length === 0 && (
        <div className="flex items-center gap-2 py-2">
          <span className="w-3.5 h-3.5 border-2 border-[#3A3A3A] border-t-[#5E6AD2] rounded-full animate-spin" />
          <span className="text-[13px] text-[#4A4A4A]">Building Clay prompts from ICP data...</span>
        </div>
      )}

      {/* AI-generated prompts */}
      {prompts.length > 0 && (
        <div className="border border-[#1E1E1E] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E1E1E]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A5A5A]">
              ICP-Generated Prompts
            </span>
            <button onClick={copyAll} className="flex items-center gap-1.5 text-[12px] text-[#5A5A5A] hover:text-white transition-colors">
              {copied === 'all' ? <Check size={13} className="text-[#2ECC71]" /> : <Copy size={13} />}
              {copied === 'all' ? 'Copied' : 'Copy all'}
            </button>
          </div>
          <div className="divide-y divide-[#1A1A1A]">
            {prompts.map((p, i) => (
              <div key={p.id || i} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5E6AD2] mb-0.5">{p.title}</p>
                    <p className="text-[12px] text-[#5A5A5A]">{p.description}</p>
                  </div>
                  <button onClick={() => copyPrompt(p.id || String(i), p.prompt)}
                    className="shrink-0 flex items-center gap-1.5 text-[12px] text-[#5A5A5A] hover:text-white transition-colors">
                    {copied === (p.id || String(i)) ? <Check size={13} className="text-[#2ECC71]" /> : <Copy size={13} />}
                    {copied === (p.id || String(i)) ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5">
                  <p className="text-[12px] text-[#A0A0A0] font-mono whitespace-pre-wrap leading-relaxed">{p.prompt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompt templates */}
      <div className="border border-[#1E1E1E] rounded-xl overflow-hidden">
        {/* Tab row */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E1E1E]">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A5A5A] shrink-0">
              Templates
            </span>
            <div className="flex items-center gap-1 bg-[#0D0D0D] border border-[#1E1E1E] rounded-lg p-0.5 flex-wrap">
              {TEMPLATE_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTemplateVariant(tab.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${templateVariant === tab.id ? 'bg-[#1E1E1E] text-white' : 'text-[#5A5A5A] hover:text-white'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={copyAllTemplates} className="flex items-center gap-1.5 text-[12px] text-[#5A5A5A] hover:text-white transition-colors shrink-0 ml-4">
            {copied === 'tmpl-all' ? <Check size={13} className="text-[#2ECC71]" /> : <Copy size={13} />}
            {copied === 'tmpl-all' ? 'Copied all' : 'Copy all'}
          </button>
        </div>
        {/* Active prompt */}
        {(() => {
          const p = ALL_TEMPLATES[templateVariant]
          return (
            <div className="px-4 py-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5E6AD2] mb-0.5">{p.title}</p>
                  <p className="text-[12px] text-[#5A5A5A]">{p.description}</p>
                </div>
                <button onClick={() => copyPrompt(p.id, p.prompt)}
                  className="shrink-0 flex items-center gap-1.5 text-[12px] text-[#5A5A5A] hover:text-white transition-colors">
                  {copied === p.id ? <Check size={13} className="text-[#2ECC71]" /> : <Copy size={13} />}
                  {copied === p.id ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5">
                <p className="text-[12px] text-[#A0A0A0] font-mono whitespace-pre-wrap leading-relaxed">{p.prompt}</p>
              </div>
            </div>
          )
        })()}
      </div>

      <RunsHistory
        runs={runs}
        onLoad={run => {
          try { setPrompts(JSON.parse(run.output)) } catch { /* ignore */ }
        }}
        clients={clients}
      />
    </div>
  )
}
