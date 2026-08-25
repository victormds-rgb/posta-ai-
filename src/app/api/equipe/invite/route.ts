import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { generateToken } from '@/lib/tokens'
import { getAppUrl } from '@/lib/get-app-url'
import { can } from '@/lib/permissions'
import { parseBody, inviteCreateSchema } from '@/lib/validation'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email/send'
import { inviteEmail } from '@/lib/email/templates'

export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageTeam')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const limit = rateLimit(`equipe:invite:${ctx.organization.id}`, 20, 60 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { data: body, error: validationError } = await parseBody(request, inviteCreateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: invite, error } = await supabase
    .from('invites')
    .insert({ org_id: ctx.organization.id, email: body.email, role: body.role, token: generateToken(), invited_by: ctx.userId })
    .select('*')
    .single()

  if (error) return serverError(error, 'equipe.invite')

  const link = `${getAppUrl()}/auth/invite?token=${invite.token}`

  // Best-effort e assíncrono — se falhar, o link já foi gerado e pode ser copiado manualmente.
  const email = inviteEmail({ orgName: ctx.organization.name, role: body.role, link })
  sendEmail({ to: body.email, subject: email.subject, html: email.html }).then((result) => {
    if (!result.success) console.error('[equipe.invite.email]', result.error)
  })

  return NextResponse.json({ invite, link })
}
