import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const formData = await request.formData()
  const file = formData.get('file') as File
  const clientId = formData.get('client_id') as string

  if (!file || !clientId) return new Response('Missing file or client_id', { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${clientId}/${Date.now()}-${safeName}`

  const { error: storageError } = await supabase.storage
    .from('client-attachments')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (storageError) return new Response(storageError.message, { status: 500 })

  const { data: urlData } = supabase.storage.from('client-attachments').getPublicUrl(path)

  const { data: attachment, error: dbError } = await supabase
    .from('client_attachments')
    .insert({
      client_id: clientId,
      type: 'file',
      name: file.name,
      url: urlData.publicUrl,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single()

  if (dbError) return new Response(dbError.message, { status: 500 })

  return Response.json({ attachment })
}
