import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import { rateLimit, rateLimitedResponse, getClientIp } from '@/lib/rate-limit'

type Params = { params: Promise<{ token: string }> }

/** Consulta pública (sem login) de um convite, usada por /auth/invite. */
export async function GET(request: Request, { params }: Params) {
  const limit = rateLimit(`invite:get:${getClientIp(request)}`, 60, 5 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { token } = await params
  const supabase = createAdminSupabase()

  const { data: invite } = await supabase.from('invites').select('*, organizations(name)').eq('token', token).maybeSingle()
  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'already_accepted' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    org_name: invite.organizations?.name,
  })
}
