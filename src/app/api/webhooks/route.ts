import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, webhookCreateSchema } from '@/lib/validation'
import { encryptSecret } from '@/lib/crypto'
import { generateToken } from '@/lib/tokens'
import type { WebhookConfig } from '@/lib/types'

export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('webhook_configs')
    .select('id, org_id, url, events, active, created_by, created_at')
    .eq('org_id', ctx.organization.id)
    .order('created_at', { ascending: false })

  if (error) return serverError(error, 'webhooks')
  return NextResponse.json({ webhooks: (data ?? []) as WebhookConfig[] })
}

/** Cria um webhook — o secret em texto puro só é devolvido nesta resposta, uma única vez. */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, webhookCreateSchema)
  if (validationError) return validationError

  const secret = generateToken(24)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('webhook_configs')
    .insert({
      org_id: ctx.organization.id,
      url: body.url,
      secret: encryptSecret(secret),
      events: body.events,
      created_by: ctx.userId,
    })
    .select('id, org_id, url, events, active, created_by, created_at')
    .single()

  if (error) return serverError(error, 'webhooks.create')
  return NextResponse.json({ webhook: data as WebhookConfig, secret }, { status: 201 })
}
