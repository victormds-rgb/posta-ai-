import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-auth'
import { createAdminSupabase } from '@/lib/supabase/server'

/** Log de auditoria global (todas as orgs) — só o super-admin do sistema vê isso. */
export async function GET(request: Request) {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('org_id')

  const supabase = createAdminSupabase()
  let query = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(100)
  if (orgId) query = query.eq('org_id', orgId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Erro ao listar auditoria' }, { status: 500 })

  return NextResponse.json({ events: data ?? [] })
}
