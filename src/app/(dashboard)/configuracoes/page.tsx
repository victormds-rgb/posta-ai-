import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/org'
import { SettingsForm } from '@/components/settings/settings-form'

export default async function ConfiguracoesPage() {
  const ctx = await getCurrentContext()
  if (!ctx) redirect('/login')

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <p className="mt-1 text-sm text-muted">Dados da organização e integrações.</p>

      <SettingsForm organization={ctx.organization} canEdit={ctx.member.role === 'admin'} />
    </div>
  )
}
