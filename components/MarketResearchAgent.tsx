'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Search, Download, ExternalLink, RotateCcw, Building2, Target, DollarSign, MessageSquare, ZoomIn, ZoomOut, Clock, Copy, Check } from 'lucide-react'
import { saveRun, loadRuns, loadAllRuns, relativeTime, type AiRun } from '@/lib/ai-runs'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Client {
  id: string
  email: string
  company_name: string
}

interface Snapshot {
  company_name: string | null
  offer: string | null
  industries: string[] | string | null
  deal_size: string | null
  cta_type: string | null
  best_customer: string | null
  result_delivered: string | null
  why_said_yes: string | null
  biggest_problem: string | null
}

interface Props {
  clients: Client[]
}

const inputCls = 'w-full px-3 py-2 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border)]'

const STAGES = [
  'Pulling client ICP data...',
  'Searching the web for competitors...',
  'Analysing offer & positioning gaps...',
  'Building strategic recommendations...',
  'Finalising intelligence report...',
]

async function buildPDF(text: string, clientName: string): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 18
  const pageW = 210
  const contentW = pageW - margin * 2
  let y = margin

  const checkY = (needed: number) => {
    if (y + needed > 280) { doc.addPage(); y = margin }
  }

  // ── Header block with logo ──
  doc.setFillColor(12, 12, 12)
  doc.rect(0, 0, pageW, 44, 'F')

  // Try to load Northstar logo
  try {
    const res = await fetch('/northstar-logo-white.png')
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    doc.addImage(dataUrl, 'PNG', margin, 9, 10, 10)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Northstar', margin + 13, 17)
  } catch {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Northstar', margin, 17)
  }

  // Divider
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.2)
  doc.line(margin, 22, pageW - margin, 22)

  // Report title
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(`${clientName} — Market Intelligence Report`, margin, 33)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(110, 110, 110)
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), margin, 40)

  y = 54

  const lines = text.split('\n')

  for (const rawLine of lines) {
    // Normalise: strip ** markers, replace em-dashes with commas, collapse indented bullets to top-level
    const line = rawLine.trimEnd()
      .replace(/\*\*/g, '')
      .replace(/\s*—\s*/g, ', ')
      .replace(/^\s+(-\s)/, '$1') // collapse indented "  - " to "- "

    if (/^-{3,}$/.test(line.trim())) {
      checkY(5)
      doc.setDrawColor(35, 35, 35)
      doc.setLineWidth(0.2)
      doc.line(margin, y, pageW - margin, y)
      y += 5
      continue
    }

    if (/^## /.test(line)) {
      checkY(14)
      y += 3
      const txt = line.replace(/^## /, '')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(94, 106, 210)
      doc.text(txt, margin, y)
      y += 2
      doc.setDrawColor(94, 106, 210)
      doc.setLineWidth(0.35)
      doc.line(margin, y, margin + Math.min(doc.getTextWidth(txt) + 2, contentW), y)
      y += 7
      continue
    }

    if (/^### /.test(line)) {
      checkY(10)
      y += 2
      const txt = line.replace(/^### /, '')
      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(55, 55, 55)
      doc.text(txt, margin, y)
      y += 6
      continue
    }

    if (/^- /.test(line)) {
      const raw = line.replace(/^- /, '')
      const wrapped = doc.splitTextToSize(raw, contentW - 6)
      checkY(wrapped.length * 5 + 2)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(55, 55, 55)
      doc.setFillColor(120, 120, 120)
      doc.circle(margin + 1.5, y - 1.3, 0.65, 'F')
      doc.text(wrapped[0], margin + 5, y)
      for (let i = 1; i < wrapped.length; i++) { y += 5; doc.text(wrapped[i], margin + 5, y) }
      y += 6
      continue
    }

    if (!line.trim()) { y += 2; continue }

    const clean = line
    const wrapped = doc.splitTextToSize(clean, contentW)
    checkY(wrapped.length * 5 + 2)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 55, 55)
    for (const l of wrapped) { doc.text(l, margin, y); y += 5 }
    y += 1
  }

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(140, 140, 140)
    doc.text(`${i} / ${total}`, pageW - margin, 290, { align: 'right' })
    doc.text('Confidential — Northstar', margin, 290)
  }

  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })
}

function SnapshotField({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2.5 py-3 border-b border-[var(--border-subtle)] last:border-0">
      <div className="shrink-0 mt-0.5 text-[var(--text-secondary)]">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-placeholder)] mb-0.5">{label}</p>
        <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{value}</p>
      </div>
    </div>
  )
}

function PDFViewer({ blobUrl, filename, onDownload, onGoogleDrive, uploading }: {
  blobUrl: string
  filename: string
  onDownload: () => void
  onGoogleDrive: () => void
  uploading: boolean
}) {
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.1)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(700)

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setWidth(containerRef.current.clientWidth - 64)
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-raised)] shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{filename}</span>
          {numPages > 0 && (
            <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">{numPages} pages</span>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.1).toFixed(1)))}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <ZoomOut size={13} />
            </button>
            <span className="text-[11px] text-[var(--text-secondary)] w-8 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(2.5, +(s + 0.1).toFixed(1)))}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <ZoomIn size={13} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onDownload} className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <Download size={12} /> Download
          </button>
          <button onClick={onGoogleDrive} disabled={uploading}
            className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40">
            {uploading
              ? <span className="w-3 h-3 border border-[#5A5A5A] border-t-white rounded-full animate-spin" />
              : <ExternalLink size={12} />}
            Google Drive
          </button>
        </div>
      </div>

      {/* Continuous scroll pages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto bg-[var(--surface-raised)] py-6 px-8">
        <Document
          file={blobUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex items-center justify-center h-40 gap-2 text-[var(--text-placeholder)] text-[13px]">
              <span className="w-3.5 h-3.5 border-2 border-[var(--border)] border-t-[#5E6AD2] rounded-full animate-spin" />
              Loading PDF...
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <div key={i} className="mb-5 flex justify-center">
              <div className="shadow-2xl rounded overflow-hidden">
                <Page
                  pageNumber={i + 1}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={Math.round(width)}
                />
              </div>
            </div>
          ))}
        </Document>
      </div>
    </div>
  )
}

const LABEL_COLORS = ['#5E6AD2', '#8B6AD2', '#6AD2B0', '#D2A06A', '#D26A6A', '#6AD2D2']
function clientColor(id: string) {
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}

function RunsHistory({ runs, onLoad, clients }: { runs: AiRun[]; onLoad: (run: AiRun) => void; clients: Client[] }) {
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
        <Clock size={10} /> Previous reports
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

export default function MarketResearchAgent({ clients }: Props) {
  const [clientId, setClientId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stageIdx, setStageIdx] = useState(0)
  const [error, setError] = useState('')
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [uploadingToGDrive, setUploadingToGDrive] = useState(false)
  const [runs, setRuns] = useState<AiRun[]>([])
  const pdfBlobRef = useRef<Blob | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedClient = clients.find(c => c.id === clientId)
  const clientMode = !!clientId
  const canRun = clientMode ? true : !!companyName.trim()

  useEffect(() => {
    loadAllRuns('market-research').then(setRuns)
  }, [])

  useEffect(() => {
    if (!clientId) {
      setSnapshot(null)
      loadAllRuns('market-research').then(setRuns)
      return
    }
    fetch(`/api/client-snapshot?client_id=${clientId}`)
      .then(r => r.json())
      .then(setSnapshot)
      .catch(() => setSnapshot(null))
    loadRuns('market-research', clientId).then(setRuns)
  }, [clientId])

  const startProgress = useCallback(() => {
    setProgress(0)
    setStageIdx(0)
    let pct = 0
    progressRef.current = setInterval(() => {
      // Asymptotic: approaches 92 but never quite stops — avoids "frozen" look
      pct = pct + Math.max(0.15, (92 - pct) * 0.022)
      if (pct > 92) pct = 92
      setProgress(Math.round(pct * 10) / 10)
      setStageIdx(Math.min(STAGES.length - 1, Math.floor((pct / 92) * STAGES.length)))
    }, 200)
  }, [])

  const stopProgress = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current)
    setProgress(95)
  }, [])

  const run = async () => {
    if (!canRun || loading) return
    setLoading(true)
    setOutput('')
    setError('')
    setPdfBlobUrl(null)
    pdfBlobRef.current = null
    startProgress()

    const res = await fetch('/api/market-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        clientMode
          ? { client_id: clientId }
          : { company_name: companyName.trim(), company_url: companyUrl.trim() }
      ),
    })

    if (!res.ok) {
      setError(await res.text() || 'Failed to run research')
      setLoading(false)
      stopProgress()
      setProgress(0)
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
    stopProgress()
    setLoading(false)

    setGeneratingPDF(true)
    setProgress(97)
    try {
      const name = clientMode ? (selectedClient?.company_name || 'Client') : companyName
      const blob = await buildPDF(fullText, name)
      pdfBlobRef.current = blob
      setPdfBlobUrl(URL.createObjectURL(blob))

      if (clientMode && clientId && fullText) {
        saveRun('market-research', clientId, fullText)
          .then(() => loadRuns('market-research', clientId).then(setRuns))
          .catch(console.error)
      }
    } catch (e) {
      console.error('PDF generation failed', e)
    }
    setProgress(100)
    setGeneratingPDF(false)
  }

  const downloadPDF = () => {
    if (!pdfBlobUrl) return
    const a = document.createElement('a')
    a.href = pdfBlobUrl
    a.download = `${(clientMode ? selectedClient?.company_name : companyName) || 'report'}-market-research.pdf`
    a.click()
  }

  const openInGoogleDrive = async () => {
    if (!pdfBlobRef.current) return
    setUploadingToGDrive(true)
    try {
      const formData = new FormData()
      const filename = `${(clientMode ? selectedClient?.company_name : companyName) || 'report'}-market-research.pdf`
      formData.append('file', pdfBlobRef.current, filename)
      formData.append('filename', filename)
      const res = await fetch('/api/save-pdf', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const { url } = await res.json()
      window.open(`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=false`, '_blank')
    } catch (e) { console.error('Upload failed', e) }
    setUploadingToGDrive(false)
  }

  const handleClientChange = (id: string) => {
    setClientId(id)
    setOutput('')
    setError('')
    setPdfBlobUrl(null)
    pdfBlobRef.current = null
    setProgress(0)
  }

  // Only show snapshot grid if there's at least one field with data
  const hasSnapshotData = snapshot && Object.values(snapshot).some(v => v && v !== snapshot.company_name)
  const industriesStr = snapshot?.industries
    ? (Array.isArray(snapshot.industries) ? snapshot.industries.join(', ') : snapshot.industries)
    : null

  const pdfFilename = clientMode
    ? `${selectedClient?.company_name} — Market Intelligence`
    : `${companyName} — Market Research`

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="max-w-xl">
        <h2 className="text-base font-medium text-[var(--text-primary)] mb-5">Market Research</h2>
        <div className="flex flex-col gap-3">
          <select value={clientId} onChange={e => handleClientChange(e.target.value)} className={inputCls}>
            <option value="">Standalone research (enter company below)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name || c.email}</option>)}
          </select>

          {!clientMode && (
            <>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && run()} placeholder="Company name" className={inputCls} />
              <input type="text" value={companyUrl} onChange={e => setCompanyUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && run()} placeholder="Website URL (optional)" className={inputCls} />
            </>
          )}

          <div className="flex gap-2">
            <button onClick={run} disabled={!canRun || loading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-[var(--accent-fg)] text-[13px] font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {loading
                ? <span className="w-3.5 h-3.5 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin" />
                : <Search size={14} />}
              {loading ? 'Researching...' : clientMode ? `Research ${selectedClient?.company_name}` : 'Run Research'}
            </button>
            {pdfBlobUrl && !loading && (
              <button onClick={run} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-lg transition-colors" title="Re-run">
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-[13px] text-red-400 max-w-xl">{error}</p>}

      {/* Loading progress */}
      {(loading || generatingPDF) && (
        <div className="max-w-xl space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-[var(--text-secondary)]">
              {generatingPDF ? 'Rendering PDF...' : STAGES[stageIdx]}
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">{progress}%</span>
          </div>
          <div className="h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#5E6AD2] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-1">
            {STAGES.map((_, i) => (
              <div key={i} className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${i <= stageIdx ? 'bg-[#5E6AD2]' : 'bg-[#1E1E1E]'}`} />
            ))}
          </div>
        </div>
      )}

      {/* Client Snapshot — only shown when there's real data */}
      {hasSnapshotData && clientMode && !loading && (
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Client Profile</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-[var(--border)] rounded-xl px-4 py-1">
              <SnapshotField icon={<Building2 size={13} />} label="Current Offer" value={snapshot?.offer} />
              <SnapshotField icon={<Target size={13} />} label="Best Customer" value={snapshot?.best_customer} />
              <SnapshotField icon={<MessageSquare size={13} />} label="Why They Buy" value={snapshot?.why_said_yes} />
            </div>
            <div className="border border-[var(--border)] rounded-xl px-4 py-1">
              <SnapshotField icon={<Target size={13} />} label="Core Result Delivered" value={snapshot?.result_delivered} />
              <SnapshotField icon={<DollarSign size={13} />} label="Deal Size" value={snapshot?.deal_size} />
              <SnapshotField icon={<Building2 size={13} />} label="Industries" value={industriesStr} />
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {pdfBlobUrl && !loading && !generatingPDF && (
        <PDFViewer
          blobUrl={pdfBlobUrl}
          filename={pdfFilename}
          onDownload={downloadPDF}
          onGoogleDrive={openInGoogleDrive}
          uploading={uploadingToGDrive}
        />
      )}

      {!loading && !generatingPDF && !pdfBlobUrl && (
        <RunsHistory
          runs={runs}
          clients={clients}
          onLoad={async run => {
            const name = clients.find(c => c.id === run.client_id)?.company_name || 'Client'
            setOutput(run.output)
            setGeneratingPDF(true)
            try {
              const blob = await buildPDF(run.output, name)
              pdfBlobRef.current = blob
              setPdfBlobUrl(URL.createObjectURL(blob))
            } catch (e) { console.error(e) }
            setGeneratingPDF(false)
          }}
        />
      )}
    </div>
  )
}
