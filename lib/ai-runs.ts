import { createClient } from '@/lib/supabase/client'

export type AiRunTool = 'copywriter' | 'clay-prompts' | 'market-research'

export interface AiRun {
  id: string
  client_id: string
  tool: AiRunTool
  output: string
  pdf_url: string | null
  created_at: string
}

export async function saveRun(
  tool: AiRunTool,
  clientId: string,
  output: string,
  pdfUrl?: string,
): Promise<void> {
  const supabase = createClient()
  await supabase.from('ai_runs').insert({
    client_id: clientId,
    tool,
    output,
    pdf_url: pdfUrl ?? null,
  })
}

export async function loadAllRuns(tool: AiRunTool, limit = 16): Promise<AiRun[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_runs')
    .select('id, client_id, tool, output, pdf_url, created_at')
    .eq('tool', tool)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

export async function loadRuns(tool: AiRunTool, clientId: string): Promise<AiRun[]> {
  if (!clientId) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_runs')
    .select('id, client_id, tool, output, pdf_url, created_at')
    .eq('client_id', clientId)
    .eq('tool', tool)
    .order('created_at', { ascending: false })
    .limit(8)
  return data || []
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
