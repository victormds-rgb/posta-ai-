import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { ensureProfile, generateConnectUrl } from '@/lib/upload-post'
import { getOrgUploadPostKey, buildUploadPostUsername } from '@/lib/org-upload-post'
import { getAppUrl } from '@/lib/get-app-url'
import { can } from '@/lib/permissions'
import type { Client, ClientSocialProfile } from '@/lib/types'

/** Cria (se necessário) o profile na Upload-Post e devolve a URL do widget de conexão. */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const apiKey = getOrgUploadPostKey(ctx.organization)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Configure a chave da Upload-Post em Configurações antes de conectar redes.' },
      { status: 400 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const clientId: string | undefined = body?.client_id
  if (!clientId) return NextResponse.json({ error: 'client_id é obrigatório' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('org_id', ctx.organization.id)
    .single<Client>()
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  let { data: profile } = await supabase
    .from('client_social_profiles')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle<ClientSocialProfile>()

  const username = profile?.upload_post_username || buildUploadPostUsername(ctx.organization.slug, client.slug)

  const ensured = await ensureProfile(apiKey, username)
  if (!ensured.success) {
    return NextResponse.json({ error: ensured.error || 'Falha ao criar profile na Upload-Post' }, { status: 502 })
  }

  if (!profile) {
    const { data: created } = await supabase
      .from('client_social_profiles')
      .insert({ org_id: ctx.organization.id, client_id: clientId, upload_post_username: username })
      .select('*')
      .single<ClientSocialProfile>()
    profile = created ?? profile
  }

  const connectResult = await generateConnectUrl(apiKey, {
    username,
    redirect_url: `${getAppUrl()}/clientes/${client.slug}/redes`,
  })
  if (!connectResult.success || !connectResult.data?.access_url) {
    return NextResponse.json({ error: connectResult.error || 'Falha ao gerar link de conexão' }, { status: 502 })
  }

  return NextResponse.json({ access_url: connectResult.data.access_url })
}
