import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TIER1_NAMES = new Set(['email', 'work_email', 'business_email'])
const PERSONAL_SUBSTRINGS = ['personal']

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, '_')
}

function detectEmailColumn(headers: string[]): { column: string } | { ambiguous: string[] } | { error: string } {
  const normalized = headers.map(normalizeHeader)
  const tier1: string[] = []
  const tier3: string[] = []

  for (let i = 0; i < headers.length; i++) {
    const norm = normalized[i]
    const isPersonal = PERSONAL_SUBSTRINGS.some(p => norm.includes(p))
    if (TIER1_NAMES.has(norm)) {
      tier1.push(headers[i])
    } else if (!isPersonal && (norm.includes('email') || norm.includes('mail'))) {
      tier3.push(headers[i])
    }
  }

  if (tier1.length === 1) return { column: tier1[0] }
  if (tier1.length > 1) return { ambiguous: tier1 }
  if (tier3.length === 1) return { column: tier3[0] }
  if (tier3.length > 1) return { ambiguous: tier3 }
  return { error: 'No email column found in CSV' }
}

function parseCSVRow(row: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/)
  const nonEmpty = lines.filter(l => l.trim() !== '')
  if (nonEmpty.length === 0) return { headers: [], rows: [] }
  return { headers: parseCSVRow(nonEmpty[0]), rows: nonEmpty.slice(1).map(parseCSVRow) }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const columnOverride = formData.get('column') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const { headers, rows } = parseCSV(text)

    if (headers.length === 0) {
      return NextResponse.json({ error: 'CSV appears to be empty' }, { status: 400 })
    }

    let targetColumn: string
    if (columnOverride) {
      if (!headers.includes(columnOverride)) {
        return NextResponse.json({ error: `Column "${columnOverride}" not found in CSV` }, { status: 400 })
      }
      targetColumn = columnOverride
    } else {
      const detection = detectEmailColumn(headers)
      if ('error' in detection) {
        return NextResponse.json({ error: detection.error }, { status: 400 })
      }
      if ('ambiguous' in detection) {
        return NextResponse.json({ status: 'ambiguous', columns: detection.ambiguous })
      }
      targetColumn = detection.column
    }

    const total = rows.length
    const runId = crypto.randomUUID()
    const storagePath = `${runId}.csv`

    // Upload raw CSV to Supabase Storage so n8n can fetch it
    const { error: uploadError } = await supabase.storage
      .from('raw-uploads')
      .upload(storagePath, new Blob([text], { type: 'text/csv' }), { contentType: 'text/csv' })

    if (uploadError) {
      return NextResponse.json({ error: `Failed to upload CSV: ${uploadError.message}` }, { status: 500 })
    }

    // Create run record in DB
    const { error: insertError } = await supabase
      .from('email_validation_runs')
      .insert({
        id: runId,
        file_name: file.name,
        total,
        valid_count: 0,
        storage_path: '',
        processed: 0,
        status: 'processing',
      })

    if (insertError) {
      return NextResponse.json({ error: `Failed to create run: ${insertError.message}` }, { status: 500 })
    }

    // Trigger n8n webhook — fire and forget, n8n runs on Railway with no timeout
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, storagePath, emailColumn: targetColumn, total, fileName: file.name }),
      }).catch(err => console.error('[validate-emails] n8n webhook error:', err))
    } else {
      console.warn('[validate-emails] N8N_WEBHOOK_URL not set — skipping webhook')
    }

    return NextResponse.json({ runId, total })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
