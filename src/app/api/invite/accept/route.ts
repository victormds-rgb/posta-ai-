import { NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'
import { notifyMany } from '@/lib/notifications'
import { rateLimit, rateLimitedResponse, getClientIp } from '@/lib/rate-limit'
import { parseBody, inviteAcceptSchema } from '@/lib/validation'
import { getAppUrl } from '@/lib/get-app-url'
import { teamMemberJoinedEmail } from '@/lib/email/templates'
import type { Member } from '@/lib/types'

/** Vincula o usuário logado à organização do convite. Requer sessão ativa. */
export async function POST(request: Request) {
  const limit = rateLimit(`invite:accept:${getClientIp(request)}`, 10, 15 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: parsed, error: validationError } = await parseBody(request, inviteAcceptSchema)
  if (validationError) return validationError
  const { token } = parsed

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

  const { data: admins } = await admin
    .from('members')
    .select('*')
    .eq('org_id', invite.org_id)
    .eq('role', 'admin')
    .eq('status', 'active')
  const adminIds = ((admins ?? []) as Member[]).map((m) => m.user_id).filter((id) => id !== user.id)
  const memberName = user.user_metadata?.full_name || user.email || 'Alguém'
  await notifyMany(admin, adminIds, {
    orgId: invite.org_id,
    type: 'team_member_joined',
    title: 'Novo membro na equipe',
    body: memberName,
    email: teamMemberJoinedEmail({ memberName, link: `${getAppUrl()}/equipe` }),
  })

  return NextResponse.json({ success: true })
}
