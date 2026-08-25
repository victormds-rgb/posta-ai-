import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { createAdminSupabase } from '@/lib/supabase/server'
import { getAgentOrgId } from '@/lib/agent-auth'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'
import type { Client } from '@/lib/types'

/** API de agente — lista os clientes da organização dona do token. */
export async function GET(request: Request) {
  const supabase = createAdminSupabase()
  const orgId = await getAgentOrgId(request, supabase)
  if (!orgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limit = rateLimit(`agent:${orgId}`, 120, 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { data, error } = await supabase.from('clients').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
  if (error) return serverError(error, 'agent.clientes')
  return NextResponse.json({ clients: (data ?? []) as Client[] })
}
