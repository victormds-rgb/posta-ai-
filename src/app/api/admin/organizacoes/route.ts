import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-auth'
import { createAdminSupabase } from '@/lib/supabase/server'
import type { Organization } from '@/lib/types'

/** Lista todas as organizações do sistema (todas — via service role, ignora RLS). */
export async function GET() {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createAdminSupabase()
  // Nunca select('*') aqui: organizations.upload_post_api_key é guardada em
  // texto puro (Fase 0, nunca migrada pro esquema de cifra da Fase 2+) — um
  // select amplo devolveria a chave de publicação de toda organização pra
  // qualquer e-mail em ADMIN_EMAILS. Lista explícita, sem essa coluna.
  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, name, slug, logo_url, plan, brand_color, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, cancel_at_period_end, trial_end, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Erro ao listar organizações' }, { status: 500 })

  return NextResponse.json({ organizations: (data ?? []) as Organization[] })
}
