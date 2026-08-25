import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

/** Revoga (apaga) um token de agente. */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('org_agent_tokens').delete().eq('id', id).eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'agent.tokens.delete')
  return NextResponse.json({ success: true })
}
