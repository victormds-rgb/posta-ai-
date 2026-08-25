'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import type { Member } from '@/lib/types'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  designer: 'Designer',
  cliente: 'Cliente',
}

export function Topbar({ member }: { member: Member }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium leading-none">{member.display_name || 'Você'}</p>
          <p className="text-xs text-muted">{ROLE_LABELS[member.role] ?? member.role}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} title="Sair">
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
