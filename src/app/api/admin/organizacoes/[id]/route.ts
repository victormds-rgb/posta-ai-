import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-auth'
import { createAdminSupabase } from '@/lib/supabase/server'
import { parseBody } from '@/lib/validation'
import { z } from 'zod'
import type { Client, Member, Organization } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

const adminPlanUpdateSchema = z.object({
  plan: z.enum(['free', 'starter', 'pro', 'agency']),
})

/** Detalhe de uma organização — equipe, clientes, uso. */
export async function GET(_request: Request, { params }: Params) {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const supabase = createAdminSupabase()

  const [{ data: org }, { data: members }, { data: clients }, { count: contentCount }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', id).maybeSingle(),
    supabase.from('members').select('*').eq('org_id', id),
    supabase.from('clients').select('*').eq('org_id', id),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('org_id', id),
  ])
  if (!org) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({
    organization: org as Organization,
    members: (members ?? []) as Member[],
    clients: (clients ?? []) as Client[],
    contentCount: contentCount ?? 0,
  })
}

/** Muda o plano de uma organização manualmente (ex.: cortesia, ajuste, suporte). */
export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const { data: body, error: validationError } = await parseBody(request, adminPlanUpdateSchema)
  if (validationError) return validationError

  const supabase = createAdminSupabase()
  const { data, error } = await supabase.from('organizations').update({ plan: body.plan }).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })

  await supabase.from('activity_log').insert({
    org_id: id,
    user_id: admin.userId,
    action: 'admin.plan_changed',
    entity_type: 'organization',
    entity_id: id,
    details: { plan: body.plan, changed_by_admin: admin.email },
  })

  return NextResponse.json({ organization: data as Organization })
}
