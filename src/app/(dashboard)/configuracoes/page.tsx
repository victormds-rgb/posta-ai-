import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { getCurrentContext } from '@/lib/org'
import { SettingsForm } from '@/components/settings/settings-form'
import { CommunicationSettings } from '@/components/settings/communication-settings'
import { AdvancedIntegrations } from '@/components/settings/advanced-integrations'
import { Card } from '@/components/ui/card'

export default async function ConfiguracoesPage() {
  const ctx = await getCurrentContext()
  if (!ctx) redirect('/login')

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <p className="mt-1 text-sm text-muted">Dados da organização e integrações.</p>

      <SettingsForm
        name={ctx.organization.name}
        brandColor={ctx.organization.brand_color}
        hasUploadPostKey={!!ctx.organization.upload_post_api_key}
        canEdit={ctx.permissions.manageSettings}
      />

      {ctx.permissions.manageBilling && (
        <Link href="/configuracoes/assinatura" className="mt-8 block">
          <Card className="flex items-center gap-3 p-4 hover:shadow-md">
            <CreditCard className="size-5 text-brand" />
            <div>
              <p className="font-medium">Assinatura</p>
              <p className="text-sm text-muted">Plano atual: {ctx.organization.plan}</p>
            </div>
          </Card>
        </Link>
      )}

      <h2 className="mt-8 mb-2 text-lg font-semibold">Comunicação</h2>
      <CommunicationSettings canEdit={ctx.permissions.manageIntegrations} />

      <h2 className="mt-8 mb-2 text-lg font-semibold">Integrações avançadas</h2>
      <AdvancedIntegrations canEdit={ctx.permissions.manageIntegrations} />
    </div>
  )
}
