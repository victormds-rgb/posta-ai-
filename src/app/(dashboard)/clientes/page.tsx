'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ClientFormModal } from '@/components/clients/client-form-modal'
import { usePermissions } from '@/hooks/use-permissions'
import type { Client } from '@/lib/types'

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[] | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const { permissions } = usePermissions()
  const canManageClients = permissions?.manageClients ?? false

  const load = useCallback(async () => {
    const res = await fetch('/api/clientes')
    if (res.ok) {
      const data = await res.json()
      setClients(data.clients)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted">Cada cliente tem seu próprio quadro de conteúdo.</p>
        </div>
        {canManageClients && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />
            Novo cliente
          </Button>
        )}
      </div>

      {clients === null ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-8" />}
          title="Nenhum cliente ainda"
          description="Crie o primeiro cliente para começar a planejar conteúdo."
          action={canManageClients ? <Button onClick={() => setModalOpen(true)}>Novo cliente</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/clientes/${client.slug}`}>
              <Card className="p-5 transition-shadow hover:shadow-md">
                <div
                  className="flex size-10 items-center justify-center rounded-lg text-white font-semibold"
                  style={{ backgroundColor: client.brand_primary_color || '#6366F1' }}
                >
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="mt-3 font-semibold">{client.name}</h3>
                {client.contact && <p className="mt-1 text-sm text-muted">{client.contact}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ClientFormModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </div>
  )
}
