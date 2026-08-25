import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/org'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  const ctx = await getCurrentContext()

  if (!ctx) {
    redirect('/login')
  }

  // Membro `role: cliente` usa a área própria do Portal (escopo restrito ao
  // seu client_id via client_members) — nunca o painel completo da agência.
  if (ctx.member.role === 'cliente') {
    redirect('/portal')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar orgName={ctx.organization.name} permissions={ctx.permissions} />
      <div className="flex flex-1 flex-col">
        <Topbar member={ctx.member} />
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  )
}
