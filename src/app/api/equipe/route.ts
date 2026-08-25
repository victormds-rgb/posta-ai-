import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'
import type { Invite, Member } from '@/lib/types'

export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createServerSupabase()
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .order('created_at', { ascending: true })

  // service_role só pra resolver e-mail de cada membro a partir de auth.users
  const admin = createAdminSupabase()
  const membersWithEmail = await Promise.all(
    ((members ?? []) as Member[]).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id)
      return { ...m, email: data?.user?.email }
    }),
  )

  const { data: invites } = await supabase
    .from('invites')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  return NextResponse.json({ members: membersWithEmail, invites: (invites ?? []) as Invite[] })
}
