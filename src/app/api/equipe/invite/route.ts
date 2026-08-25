import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { generateToken } from '@/lib/tokens'
import { getAppUrl } from '@/lib/get-app-url'
import { can } from '@/lib/permissions'
import type { UserRole } from '@/lib/types'

const VALID_ROLES: UserRole[] = ['admin', 'gestor', 'designer', 'cliente']

export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member.role, 'manageTeam')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const email: string | undefined = body?.email?.trim().toLowerCase()
  const role: UserRole = VALID_ROLES.includes(body?.role) ? body.role : 'designer'
  if (!email) return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: invite, error } = await supabase
    .from('invites')
    .insert({ org_id: ctx.organization.id, email, role, token: generateToken(), invited_by: ctx.userId })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    invite,
    link: `${getAppUrl()}/auth/invite?token=${invite.token}`,
  })
}
