'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Users, CalendarDays, UsersRound, Settings, Rocket, Megaphone, ListTodo } from 'lucide-react'
import type { RolePermissions } from '@/lib/types'

const NAV: { href: string; label: string; icon: typeof Users; requires?: keyof RolePermissions }[] = [
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { href: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { href: '/calendario', label: 'Calendário', icon: CalendarDays },
  { href: '/equipe', label: 'Equipe', icon: UsersRound },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, requires: 'manageSettings' },
]

export function Sidebar({ orgName, permissions }: { orgName: string; permissions: RolePermissions }) {
  const pathname = usePathname()
  const items = NAV.filter((item) => !item.requires || permissions[item.requires])

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <Rocket className="size-5 text-brand" />
        <span className="font-semibold">Posta AI</span>
      </div>
      <p className="px-5 pb-3 text-xs text-muted truncate" title={orgName}>
        {orgName}
      </p>
      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
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
