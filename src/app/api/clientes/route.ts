import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'
import { can } from '@/lib/permissions'
import { parseBody, clientCreateSchema } from '@/lib/validation'
import { assertWithinClientLimit } from '@/lib/plan-limits'
import { getPortalClientIds } from '@/lib/portal'
import type { Client } from '@/lib/types'

export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createServerSupabase()

  // Membro `role: cliente` só enxerga o(s) cliente(s) vinculado(s) a ele no
  // Portal (client_members) — nunca a carteira inteira da organização.
  if (ctx.member.role === 'cliente') {
    const clientIds = await getPortalClientIds(supabase, ctx.member.id)
    if (clientIds.length === 0) return NextResponse.json({ clients: [] })
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('org_id', ctx.organization.id)
      .in('id', clientIds)
      .order('created_at', { ascending: false })
    if (error) return serverError(error, 'clientes')
    return NextResponse.json({ clients: (data ?? []) as Client[] })
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .order('created_at', { ascending: false })

  if (error) return serverError(error, 'clientes')
  return NextResponse.json({ clients: (data ?? []) as Client[] })
}

export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageClients')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, clientCreateSchema)
  if (validationError) return validationError
  const { name } = body

  const supabase = await createServerSupabase()

  const limitCheck = await assertWithinClientLimit(supabase, ctx.organization.id, ctx.organization.plan)
  if (!limitCheck.ok) return NextResponse.json({ error: limitCheck.reason }, { status: 402 })

  const baseSlug = slugify(name) || 'cliente'
  let slug = baseSlug
  for (let attempt = 1; attempt <= 20; attempt++) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('org_id', ctx.organization.id)
      .eq('slug', slug)
      .maybeSingle()
    if (!existing) break
    slug = `${baseSlug}-${attempt + 1}`
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      org_id: ctx.organization.id,
      name,
      slug,
      contact: body.contact || null,
      notes: body.notes || null,
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'clientes')

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'client.created',
    entity_type: 'client',
    entity_id: (data as Client).id,
    details: { name },
  })

  return NextResponse.json({ client: data as Client }, { status: 201 })
}
