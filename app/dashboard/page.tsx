import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientDashboard from '@/components/ClientDashboard'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, company_name, role, docusign_url, onboarding_stage, docusign_acknowledged, company_logo_url')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="rounded-lg p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Profile not found</p>
          <p style={{ color: 'var(--text-secondary)' }}>Please contact your administrator to set up your account.</p>
        </div>
      </div>
    )
  }

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('client_id', user.id)

  return (
    <ClientDashboard
      profile={profile}
      campaigns={campaigns || []}
    />
  )
}
