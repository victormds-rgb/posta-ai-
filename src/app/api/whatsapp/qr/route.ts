import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { can } from '@/lib/permissions'
import { getOrgWhatsAppConfig } from '@/lib/org-whatsapp'
import { zapiGetQrCode } from '@/lib/zapi'

/** QR code (base64) pra parear o WhatsApp com a instância Z-API da organização. */
export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const config = await getOrgWhatsAppConfig(ctx.organization.id)
  if (!config) return NextResponse.json({ error: 'WhatsApp não configurado para esta organização.' }, { status: 404 })

  const result = await zapiGetQrCode(config.instance_id, config.token)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 502 })
  if (result.data?.connected) return NextResponse.json({ connected: true })

  return NextResponse.json({ connected: false, qrCode: result.data?.value })
}
