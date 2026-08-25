'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Badge } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'

interface AuditEvent {
  id: string
  org_id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export default function AdminAuditoriaPage() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/auditoria')
    if (res.ok) setEvents((await res.json()).events)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  return (
    <div>
      <h1 className="text-2xl font-bold">Auditoria</h1>
      <p className="mt-1 text-sm text-muted">Últimos 100 eventos de todas as organizações do produto.</p>

      {events === null ? (
        <p className="mt-4 text-sm text-muted">Carregando…</p>
      ) : (
        <Card className="mt-4 divide-y divide-border">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <Badge>{e.action}</Badge>
                <p className="mt-1 truncate text-xs text-muted">
                  org {e.org_id.slice(0, 8)}… · {e.entity_type ?? '—'}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted">{formatDateTime(e.created_at)}</span>
            </div>
          ))}
          {events.length === 0 && <p className="p-4 text-sm text-muted">Nenhum evento ainda.</p>}
        </Card>
      )}
    </div>
  )
}
