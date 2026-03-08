import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const formData = await request.formData()
  const file = formData.get('file') as File
  const filename = (formData.get('filename') as string) || 'report.pdf'

  if (!file) return new Response('Missing file', { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)
  const path = `reports/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error } = await supabase.storage
    .from('client-attachments')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false })

  if (error) return new Response(error.message, { status: 500 })

  const { data } = supabase.storage.from('client-attachments').getPublicUrl(path)

  return Response.json({ url: data.publicUrl })
}
