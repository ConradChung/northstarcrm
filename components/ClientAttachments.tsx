'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, Link2, FileText, Trash2, Plus, ExternalLink, Upload, ChevronDown, ChevronUp, X } from 'lucide-react'

interface Attachment {
  id: string
  type: 'file' | 'link'
  name: string
  url: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

export default function ClientAttachments({ clientId }: { clientId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [expanded, setExpanded] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [addingLink, setAddingLink] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (expanded) loadAttachments()
  }, [expanded, clientId])

  const loadAttachments = async () => {
    const { data } = await supabase
      .from('client_attachments')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (data) setAttachments(data)
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('client_id', clientId)
    const res = await fetch('/api/client-attachments/upload', { method: 'POST', body: formData })
    if (res.ok) {
      const { attachment } = await res.json()
      setAttachments(prev => [attachment, ...prev])
    }
    setUploading(false)
  }

  const addLink = async () => {
    if (!linkUrl.trim() || addingLink) return
    setAddingLink(true)
    let name = linkName.trim()
    if (!name) {
      try { name = new URL(linkUrl).hostname } catch { name = linkUrl }
    }
    const { data } = await supabase
      .from('client_attachments')
      .insert({ client_id: clientId, type: 'link', name, url: linkUrl.trim() })
      .select()
      .single()
    if (data) {
      setAttachments(prev => [data, ...prev])
      setLinkUrl('')
      setLinkName('')
      setShowLinkForm(false)
    }
    setAddingLink(false)
  }

  const deleteAttachment = async (a: Attachment) => {
    await fetch('/api/client-attachments/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, type: a.type, url: a.url }),
    })
    setAttachments(prev => prev.filter(x => x.id !== a.id))
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      for (const file of files) await uploadFile(file)
      return
    }
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (text?.startsWith('http')) {
      setLinkUrl(text.trim())
      setShowLinkForm(true)
    }
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const count = attachments.length

  return (
    <div className="mt-3 pt-3 border-t border-[#1A1A1A]" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 text-[12px] text-[#5A5A5A] hover:text-[#A0A0A0] transition-colors w-full"
      >
        <Paperclip size={12} />
        <span>Attachments{count > 0 ? ` · ${count}` : ''}</span>
        {expanded ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center gap-1.5 py-4 rounded-lg border border-dashed cursor-pointer transition-colors ${
              dragOver
                ? 'border-[#5E6AD2] bg-[#5E6AD2]/5'
                : 'border-[#2A2A2A] hover:border-[#3A3A3A] bg-[#0A0A0A]'
            }`}
          >
            <Upload size={14} className={dragOver ? 'text-[#5E6AD2]' : 'text-[#4A4A4A]'} />
            <p className="text-[11px] text-[#4A4A4A]">
              {uploading ? 'Uploading...' : 'Drop files or click to upload'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => Array.from(e.target.files || []).forEach(uploadFile)}
            />
          </div>

          {/* Add link */}
          {showLinkForm ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addLink()}
                  placeholder="https://..."
                  autoFocus
                  className="flex-1 px-2.5 py-1.5 bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg text-[12px] text-white placeholder-[#3A3A3A] focus:outline-none focus:border-[#3A3A3A]"
                />
                <button
                  onClick={() => { setShowLinkForm(false); setLinkUrl(''); setLinkName('') }}
                  className="text-[#4A4A4A] hover:text-white p-1"
                >
                  <X size={12} />
                </button>
              </div>
              <input
                type="text"
                value={linkName}
                onChange={e => setLinkName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addLink()}
                placeholder="Label (optional)"
                className="w-full px-2.5 py-1.5 bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg text-[12px] text-white placeholder-[#3A3A3A] focus:outline-none focus:border-[#3A3A3A]"
              />
              <button
                onClick={addLink}
                disabled={!linkUrl.trim() || addingLink}
                className="px-3 py-1 bg-white text-[#0A0A0A] text-[11px] font-medium rounded-lg hover:bg-[#E0E0E0] disabled:opacity-40"
              >
                {addingLink ? 'Adding...' : 'Add link'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLinkForm(true)}
              className="flex items-center gap-1.5 text-[11px] text-[#5A5A5A] hover:text-[#A0A0A0] transition-colors"
            >
              <Plus size={11} />
              Add link
            </button>
          )}

          {/* List */}
          {attachments.length > 0 ? (
            <div className="space-y-0.5">
              {attachments.map(a => (
                <div key={a.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#111111] group">
                  {a.type === 'link'
                    ? <Link2 size={12} className="text-[#5E6AD2] shrink-0" />
                    : <FileText size={12} className="text-[#5A5A5A] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white truncate">{a.name}</p>
                    {a.file_size != null && (
                      <p className="text-[10px] text-[#4A4A4A]">{formatSize(a.file_size)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[#5A5A5A] hover:text-white">
                      <ExternalLink size={12} />
                    </a>
                    <button onClick={() => deleteAttachment(a)} className="text-[#5A5A5A] hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : !uploading && (
            <p className="text-[11px] text-[#3A3A3A] px-1">No attachments yet</p>
          )}
        </div>
      )}
    </div>
  )
}
