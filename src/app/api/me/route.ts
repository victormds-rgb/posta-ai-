import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { isOrgAdmin } from '@/lib/permissions'

/** Contexto leve do usuário logado, pra componentes de cliente decidirem o que mostrar. */
export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  return NextResponse.json({
    role: ctx.member.role,
    isAdmin: isOrgAdmin(ctx.member),
    permissions: ctx.permissions,
  })
}
