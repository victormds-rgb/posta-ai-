import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/org'
import { PortalSidebar } from '@/components/layout/portal-sidebar'
import { Topbar } from '@/components/layout/topbar'

export default async function PortalLayout({ children }: LayoutProps<'/portal'>) {
  const ctx = await getCurrentContext()

  if (!ctx) redirect('/login')
  // Só membros `role: cliente` usam o Portal — staff da agência usa o painel completo.
  if (ctx.member.role !== 'cliente') redirect('/clientes')

  return (
    <div className="flex min-h-screen">
      <PortalSidebar orgName={ctx.organization.name} />
      <div className="flex flex-1 flex-col">
        <Topbar member={ctx.member} />
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  )
}
