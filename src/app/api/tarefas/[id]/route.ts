import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, taskUpdateSchema } from '@/lib/validation'
import type { Task } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).eq('org_id', ctx.organization.id).maybeSingle()
  if (error) return serverError(error, 'tarefas.get')
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ task: data as Task })
}

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { data: body, error: validationError } = await parseBody(request, taskUpdateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const updates: Record<string, unknown> = {}
  for (const key of [
    'title',
    'description',
    'client_id',
    'campaign_id',
    'content_item_id',
    'status',
    'due_date',
    'assigned_to',
    'checklist',
  ] as const) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.organization.id)
    .select('*')
    .single()

  if (error) return serverError(error, 'tarefas.update')
  return NextResponse.json({ task: data as Task })
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('tasks').delete().eq('id', id).eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'tarefas.delete')
  return NextResponse.json({ success: true })
}
