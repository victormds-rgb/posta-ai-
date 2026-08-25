import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, agentTokenCreateSchema } from '@/lib/validation'
import { generateAgentToken } from '@/lib/agent-auth'
import type { OrgAgentToken } from '@/lib/types'

export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('org_agent_tokens')
    .select('id, org_id, name, token_prefix, last_used_at, created_at')
    .eq('org_id', ctx.organization.id)
    .order('created_at', { ascending: false })

  if (error) return serverError(error, 'agent.tokens')
  return NextResponse.json({ tokens: (data ?? []) as OrgAgentToken[] })
}

/** Gera um novo token de agente — o valor em texto puro só é devolvido nesta resposta. */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, agentTokenCreateSchema)
  if (validationError) return validationError

  const { token, hash, prefix } = generateAgentToken()
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('org_agent_tokens')
    .insert({ org_id: ctx.organization.id, name: body.name, token_hash: hash, token_prefix: prefix, created_by: ctx.userId })
    .select('id, org_id, name, token_prefix, last_used_at, created_at')
    .single()

  if (error) return serverError(error, 'agent.tokens.create')
  return NextResponse.json({ token: data as OrgAgentToken, secret: token }, { status: 201 })
}
