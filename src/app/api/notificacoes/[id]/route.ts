import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

/** Marca uma notificação como lida (ou não-lida). RLS já restringe ao dono. */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const read = typeof body.read === 'boolean' ? body.read : true

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('notifications')
    .update({ read })
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .select('*')
    .single()

  if (error) return serverError(error, 'notificacoes.update')
  return NextResponse.json({ notification: data })
}
