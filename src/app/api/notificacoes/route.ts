import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Notification } from '@/lib/types'

/** Notificações do usuário logado (RLS já restringe a `user_id = auth.uid()`). */
export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return serverError(error, 'notificacoes.list')

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('read', false)

  return NextResponse.json({ notifications: (data ?? []) as Notification[], unreadCount: count ?? 0 })
}
