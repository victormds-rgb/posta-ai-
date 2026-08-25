'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ContentCard } from '@/components/content/content-card'
import { ContentModal } from '@/components/content/content-modal'
import { CONTENT_STATUSES, type ContentItem, type ContentStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/use-permissions'

export function KanbanBoard({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<ContentItem[] | null>(null)
  const [modalState, setModalState] = useState<{ open: boolean; item: ContentItem | null; status: ContentStatus }>({
    open: false,
    item: null,
    status: 'ideia',
  })
  const [dragOverColumn, setDragOverColumn] = useState<ContentStatus | null>(null)
  const { permissions } = usePermissions()
  const canManageContent = permissions?.manageContent ?? false

  const load = useCallback(async () => {
    const res = await fetch(`/api/conteudos?client_id=${clientId}`)
    if (res.ok) {
      const data = await res.json()
      setItems(data.items)
    }
  }, [clientId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function moveItem(id: string, status: ContentStatus) {
    setItems((prev) => (prev ? prev.map((i) => (i.id === id ? { ...i, status } : i)) : prev))
    await fetch(`/api/conteudos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  function handleDrop(status: ContentStatus, e: React.DragEvent) {
    e.preventDefault()
    setDragOverColumn(null)
    if (!canManageContent) return
    const id = e.dataTransfer.getData('text/plain')
    if (id) moveItem(id, status)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {CONTENT_STATUSES.map((column) => {
        const columnItems = items?.filter((i) => i.status === column.value) ?? []
        return (
          <div
            key={column.value}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverColumn(column.value)
            }}
            onDragLeave={() => setDragOverColumn((c) => (c === column.value ? null : c))}
            onDrop={(e) => handleDrop(column.value, e)}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-xl border border-border bg-black/[0.02] p-3 transition-colors',
              dragOverColumn === column.value && 'border-brand bg-brand-soft/50',
            )}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold">
                {column.label} <span className="text-muted">({columnItems.length})</span>
              </h3>
              {canManageContent && (
                <button
                  onClick={() => setModalState({ open: true, item: null, status: column.value })}
                  className="rounded-md p-1 text-muted hover:bg-brand-soft hover:text-brand"
                  aria-label={`Novo em ${column.label}`}
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>

            <div className="flex-1 space-y-2">
              {columnItems.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  draggable={canManageContent}
                  onClick={() => setModalState({ open: true, item, status: item.status })}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                />
              ))}
              {columnItems.length === 0 && items !== null && (
                <p className="px-1 py-6 text-center text-xs text-muted">Arraste um card aqui</p>
              )}
            </div>
          </div>
        )
      })}

      <ContentModal
        open={modalState.open}
        onClose={() => setModalState((s) => ({ ...s, open: false }))}
        clientId={clientId}
        defaultStatus={modalState.status}
        item={modalState.item}
        onSaved={load}
        onDeleted={load}
      />
    </div>
  )
}
