import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const supabase = await createClient()

    const { data: run, error } = await supabase
      .from('email_validation_runs')
      .select('*')
      .eq('id', runId)
      .single()

    if (error || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    let signedUrl: string | null = null
    if (run.status === 'complete' && run.storage_path) {
      const { data } = await supabase.storage
        .from('validation-results')
        .createSignedUrl(run.storage_path, 3600)
      signedUrl = data?.signedUrl ?? null
    }

    return NextResponse.json({
      processed: run.processed ?? 0,
      total: run.total,
      valid_count: run.valid_count,
      status: run.status ?? 'processing',
      storage_path: run.storage_path,
      file_name: run.file_name,
      signedUrl,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
