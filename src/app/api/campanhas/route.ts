import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, campaignCreateSchema } from '@/lib/validation'
import type { Campaign } from '@/lib/types'

/**
 * Campanhas são um módulo interno da agência (planejamento) — o role
 * `cliente` não usa o Portal pra isso, então nem enxerga esta rota.
 */
function forbidPortalRole(role: string) {
  return role === 'cliente'
}

export async function GET(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (forbidPortalRole(ctx.member.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  const supabase = await createServerSupabase()
  let query = supabase.from('campaigns').select('*').eq('org_id', ctx.organization.id).order('start_date', { ascending: true })
  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return serverError(error, 'campanhas')
  return NextResponse.json({ campaigns: (data ?? []) as Campaign[] })
}

export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, campaignCreateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: client } = await supabase.from('clients').select('id').eq('id', body.client_id).eq('org_id', ctx.organization.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      org_id: ctx.organization.id,
      client_id: body.client_id,
      name: body.name,
      description: body.description || null,
      color: body.color || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      status: body.status || 'planejada',
      created_by: ctx.userId,
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'campanhas.create')

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'campaign.created',
    entity_type: 'campaign',
    entity_id: (data as Campaign).id,
    details: { name: body.name },
  })

  return NextResponse.json({ campaign: data as Campaign }, { status: 201 })
}
