import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, contentSourceCreateSchema } from '@/lib/validation'
import type { ContentSource } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Lista o material de referência colado manualmente pra este cliente (nunca raspado automaticamente). */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id: clientId } = await params
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('content_sources')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return serverError(error, 'ia.fontes')
  return NextResponse.json({ sources: (data ?? []) as ContentSource[] })
}

/** Adiciona um material de referência (texto colado pela equipe — sem raspagem automática). */
export async function POST(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: clientId } = await params
  const { data: body, error: validationError } = await parseBody(request, contentSourceCreateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('content_sources')
    .insert({
      org_id: ctx.organization.id,
      client_id: clientId,
      title: body.title,
      source_url: body.source_url || null,
      raw_text: body.raw_text,
      added_by: ctx.userId,
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'ia.fontes.create')
  return NextResponse.json({ source: data as ContentSource }, { status: 201 })
}
