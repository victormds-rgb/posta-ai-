import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, taskCreateSchema } from '@/lib/validation'
import type { Task } from '@/lib/types'

export async function GET(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const campaignId = searchParams.get('campaign_id')
  const assignedTo = searchParams.get('assigned_to')
  const status = searchParams.get('status')

  const supabase = await createServerSupabase()
  let query = supabase.from('tasks').select('*').eq('org_id', ctx.organization.id).order('due_date', { ascending: true })
  if (clientId) query = query.eq('client_id', clientId)
  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return serverError(error, 'tarefas')
  return NextResponse.json({ tasks: (data ?? []) as Task[] })
}

export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, taskCreateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      org_id: ctx.organization.id,
      client_id: body.client_id || null,
      campaign_id: body.campaign_id || null,
      content_item_id: body.content_item_id || null,
      title: body.title,
      description: body.description || null,
      status: body.status || 'pendente',
      due_date: body.due_date || null,
      assigned_to: body.assigned_to || null,
      checklist: body.checklist ?? [],
      created_by: ctx.userId,
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'tarefas.create')

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'task.created',
    entity_type: 'task',
    entity_id: (data as Task).id,
    details: { title: body.title },
  })

  return NextResponse.json({ task: data as Task }, { status: 201 })
}
