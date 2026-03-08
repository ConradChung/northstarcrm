import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { id, type, url } = await request.json()

  if (!id) return new Response('Missing id', { status: 400 })

  if (type === 'file') {
    // Extract storage path from public URL
    const match = url?.match(/\/client-attachments\/(.+)$/)
    if (match?.[1]) {
      await supabase.storage.from('client-attachments').remove([match[1]])
    }
  }

  const { error } = await supabase.from('client_attachments').delete().eq('id', id)
  if (error) return new Response(error.message, { status: 500 })

  return new Response(null, { status: 204 })
}
