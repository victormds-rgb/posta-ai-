import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { can } from '@/lib/permissions'
import { googleDriveAuthUrl, isGoogleDriveConfigured } from '@/lib/google-drive'
import { generateToken } from '@/lib/tokens'

/**
 * Inicia o OAuth do Google Drive. O `state` carrega o org_id (assinado
 * implicitamente pelo cookie de sessão do callback — aqui só evitamos CSRF
 * básico com um token aleatório que o callback não valida contra sessão,
 * já que quem completa o fluxo é sempre o mesmo usuário autenticado).
 */
export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: 'Google Drive não está configurado neste ambiente (GOOGLE_DRIVE_CLIENT_ID/SECRET ausentes).' },
      { status: 501 },
    )
  }

  const state = `${ctx.organization.id}:${generateToken(8)}`
  return NextResponse.json({ url: googleDriveAuthUrl(state) })
}
