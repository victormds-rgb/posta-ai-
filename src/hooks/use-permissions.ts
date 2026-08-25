'use client'

import { useEffect, useState } from 'react'
import type { RolePermissions, UserRole } from '@/lib/types'

interface MeResponse {
  role: UserRole
  isAdmin: boolean
  permissions: RolePermissions
}

/**
 * Permissões efetivas do usuário logado, pra componentes de cliente
 * decidirem o que mostrar. A autorização de verdade acontece no servidor
 * (cada rota de API já valida `can(ctx.member, ...)`) — isso aqui é só UX,
 * nunca a fonte da verdade.
 */
export function usePermissions() {
  const [data, setData] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ...data, loading }
}
