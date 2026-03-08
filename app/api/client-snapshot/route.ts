import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const client_id = new URL(request.url).searchParams.get('client_id')
  if (!client_id) return Response.json(null)

  const supabase = await createClient()

  const [profileRes, s2Res, s3Res] = await Promise.all([
    supabase.from('profiles').select('company_name, email').eq('id', client_id).single(),
    supabase.from('stage2_onboarding').select('*').eq('client_id', client_id).maybeSingle(),
    supabase.from('onboarding_forms').select('*').eq('client_id', client_id).maybeSingle(),
  ])

  return Response.json({
    company_name: profileRes.data?.company_name,
    offer: s3Res.data?.offer_description,
    industries: s3Res.data?.industries,
    deal_size: s3Res.data?.deal_size_range,
    cta_type: s3Res.data?.cta_type,
    best_customer: s2Res.data?.best_client_description,
    result_delivered: s2Res.data?.result_delivered,
    why_said_yes: s2Res.data?.why_said_yes,
    biggest_problem: s2Res.data?.biggest_problem,
  })
}
