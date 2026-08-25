import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-auth'
import { createAdminSupabase } from '@/lib/supabase/server'
import type { Organization } from '@/lib/types'

/** Lista todas as organizações do sistema (todas — via service role, ignora RLS). */
export async function GET() {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createAdminSupabase()
  const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Erro ao listar organizações' }, { status: 500 })

  return NextResponse.json({ organizations: (data ?? []) as Organization[] })
}
