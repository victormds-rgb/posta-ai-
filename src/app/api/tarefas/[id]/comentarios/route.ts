import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, taskCommentSchema } from '@/lib/validation'
import type { TaskComment } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id: taskId } = await params
  const supabase = await createServerSupabase()
  const { data: task } = await supabase.from('tasks').select('id').eq('id', taskId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!task) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) return serverError(error, 'tarefas.comentarios')
  return NextResponse.json({ comments: (data ?? []) as TaskComment[] })
}

export async function POST(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: taskId } = await params
  const { data: body, error: validationError } = await parseBody(request, taskCommentSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: task } = await supabase.from('tasks').select('id').eq('id', taskId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!task) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('task_comments')
    .insert({ org_id: ctx.organization.id, task_id: taskId, user_id: ctx.userId, body: body.body })
    .select('*')
    .single()

  if (error) return serverError(error, 'tarefas.comentarios.create')
  return NextResponse.json({ comment: data as TaskComment }, { status: 201 })
}
