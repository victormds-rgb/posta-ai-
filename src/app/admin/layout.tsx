import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireSuperAdmin } from '@/lib/admin-auth'
import { LayoutDashboard, Building2, ScrollText, Rocket } from 'lucide-react'

const NAV = [
  { href: '/admin', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/admin/organizacoes', label: 'Organizações', icon: Building2 },
  { href: '/admin/auditoria', label: 'Auditoria', icon: ScrollText },
]

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const admin = await requireSuperAdmin()
  // Autorização por e-mail (ADMIN_EMAILS), nunca por role de organização —
  // ver src/lib/admin-auth.ts. Quem não está na lista nem vê o painel existir.
  if (!admin) redirect('/clientes')

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 px-5 py-5">
          <Rocket className="size-5 text-brand" />
          <span className="font-semibold">Posta AI</span>
        </div>
        <p className="px-5 pb-3 text-xs text-muted">Painel administrativo</p>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-brand-soft hover:text-foreground"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <Link href="/clientes" className="text-xs text-muted hover:text-foreground">
            ← Voltar pro painel normal
          </Link>
        </div>
      </aside>
      <main className="flex-1 bg-background p-6">{children}</main>
    </div>
  )
}
