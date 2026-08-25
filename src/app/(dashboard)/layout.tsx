import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/org'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  const ctx = await getCurrentContext()

  if (!ctx) {
    redirect('/login')
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
