import { NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'

/** Vincula o usuário logado à organização do convite. Requer sessão ativa. */
export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const token: string | undefined = body?.token
  if (!token) return NextResponse.json({ error: 'token é obrigatório' }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: invite } = await admin.from('invites').select('*').eq('token', token).maybeSingle()
  if (!invite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Convite já utilizado' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })
  }
  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ error: 'Este convite foi enviado para outro e-mail.' }, { status: 403 })
  }

  await admin.from('members').upsert(
    {
      user_id: user.id,
      org_id: invite.org_id,
      role: invite.role,
      display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
      status: 'active',
    },
    { onConflict: 'user_id,org_id' },
  )

  await admin.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id)

  return NextResponse.json({ success: true })
}
