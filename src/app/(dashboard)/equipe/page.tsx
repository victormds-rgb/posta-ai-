import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/org'
import { isOrgAdmin } from '@/lib/permissions'
import { EquipeClient } from '@/components/team/equipe-client'

export default async function EquipePage() {
  const ctx = await getCurrentContext()
  if (!ctx) redirect('/login')

  return <EquipeClient isAdmin={isOrgAdmin(ctx.member)} canManageTeam={ctx.permissions.manageTeam} />
}
