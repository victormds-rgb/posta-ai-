import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can, isOrgAdmin, ROLE_PERMISSIONS } from '@/lib/permissions'
import { notify } from '@/lib/notifications'
import { getAppUrl } from '@/lib/get-app-url'
import { permissionsChangedEmail } from '@/lib/email/templates'
import type { RolePermissions, UserRole } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

const VALID_ROLES: UserRole[] = ['admin', 'gestor', 'designer', 'cliente']
const PERMISSION_KEYS = Object.keys(ROLE_PERMISSIONS.admin) as (keyof RolePermissions)[]

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const wantsRoleOrPermissionChange = 'role' in body || 'custom_permissions' in body
  const wantsStatusChange = 'status' in body

  // Alterar role/permissões de outro membro é uma operação sensível — exige
  // ser admin de organização de verdade, não apenas ter `manageTeam`
  // concedido por override (evita que alguém se autopromova via permissão).
  if (wantsRoleOrPermissionChange && !isOrgAdmin(ctx.member)) {
    return NextResponse.json({ error: 'Apenas admins podem alterar papel ou permissões.' }, { status: 403 })
  }
  if (wantsStatusChange && !can(ctx.member, 'manageTeam')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!wantsRoleOrPermissionChange && !wantsStatusChange) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const supabase = await createServerSupabase()

  // Um admin não pode se auto-rebaixar por esta rota (evita a org ficar sem admin).
  const { data: target } = await supabase.from('members').select('*').eq('id', id).eq('org_id', ctx.organization.id).maybeSingle()
  if (!target) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
  if (target.user_id === ctx.userId && wantsRoleOrPermissionChange && body.role && body.role !== 'admin') {
    return NextResponse.json({ error: 'Você não pode remover seu próprio acesso de admin.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.role) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })
    }
    updates.role = body.role
  }
  if (body.status) updates.status = body.status
  if ('custom_permissions' in body) {
    if (body.custom_permissions === null) {
      updates.custom_permissions = null
    } else if (isValidPermissionOverride(body.custom_permissions)) {
      updates.custom_permissions = body.custom_permissions
    } else {
      return NextResponse.json({ error: 'custom_permissions inválido' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.organization.id)
    .select('*')
    .single()

  if (error) return serverError(error, 'equipe.update')

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'member.updated',
    entity_type: 'member',
    entity_id: id,
    details: updates,
  })

  if (wantsRoleOrPermissionChange && target.user_id !== ctx.userId) {
    await notify(supabase, {
      orgId: ctx.organization.id,
      userId: target.user_id,
      type: 'permissions_changed',
      title: 'Suas permissões foram alteradas',
      body: body.role ? `Novo papel: ${body.role}` : undefined,
      referenceId: id,
      referenceType: 'member',
      email: permissionsChangedEmail({ newRole: body.role, link: `${getAppUrl()}/clientes` }),
    })
  }

  return NextResponse.json({ member: data })
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageTeam')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('members')
    .update({ status: 'inactive' })
    .eq('id', id)
    .eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'equipe.update')
  return NextResponse.json({ success: true })
}

function isValidPermissionOverride(value: unknown): value is Partial<RolePermissions> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.entries(value).every(
    ([key, val]) => PERMISSION_KEYS.includes(key as keyof RolePermissions) && typeof val === 'boolean',
  )
}
