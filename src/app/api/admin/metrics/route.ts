import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-auth'
import { createAdminSupabase } from '@/lib/supabase/server'
import { PLAN_PRICES_BRL } from '@/lib/stripe'
import type { Organization } from '@/lib/types'

/** Métricas globais do produto — vê todas as organizações, via service role. */
export async function GET() {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createAdminSupabase()

  const [{ data: orgs }, { count: totalMembers }, { count: totalContent }, { count: totalClients }] = await Promise.all([
    supabase.from('organizations').select('*'),
    supabase.from('members').select('id', { count: 'exact', head: true }),
    supabase.from('content_items').select('id', { count: 'exact', head: true }),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
  ])

  const organizations = (orgs ?? []) as Organization[]
  const byPlan: Record<string, number> = {}
  let mrrBRL = 0
  for (const org of organizations) {
    byPlan[org.plan] = (byPlan[org.plan] ?? 0) + 1
    if (org.subscription_status === 'active' && org.plan in PLAN_PRICES_BRL) {
      mrrBRL += PLAN_PRICES_BRL[org.plan as keyof typeof PLAN_PRICES_BRL].monthly
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const newOrgsLast30d = organizations.filter((o) => o.created_at >= thirtyDaysAgo).length

  return NextResponse.json({
    totalOrganizations: organizations.length,
    newOrgsLast30d,
    byPlan,
    mrrBRL,
    totalMembers: totalMembers ?? 0,
    totalClients: totalClients ?? 0,
    totalContent: totalContent ?? 0,
  })
}
