import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createServerSupabase()
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', ctx.userId).eq('read', false)

  if (error) return serverError(error, 'notificacoes.mark-all-read')
  return NextResponse.json({ success: true })
}
