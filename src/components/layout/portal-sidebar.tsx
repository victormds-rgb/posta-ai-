'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Palette, FolderOpen, Rocket } from 'lucide-react'

const NAV = [
  { href: '/portal', label: 'Conteúdo', icon: LayoutDashboard },
  { href: '/portal/brand', label: 'Brand book', icon: Palette },
  { href: '/portal/acervo', label: 'Acervo digital', icon: FolderOpen },
]

export function PortalSidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <Rocket className="size-5 text-brand" />
        <span className="font-semibold">Posta AI</span>
      </div>
      <p className="px-5 pb-3 text-xs text-muted truncate" title={orgName}>
        Portal do cliente · {orgName}
      </p>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-brand-soft hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
