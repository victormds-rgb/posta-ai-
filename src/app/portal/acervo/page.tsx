'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { FolderOpen, Folder, Download } from 'lucide-react'
import type { Client, MediaFile, MediaFolder } from '@/lib/types'

export default function PortalAcervoPage() {
  const [clients, setClients] = useState<Client[] | null>(null)
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [folders, setFolders] = useState<MediaFolder[] | null>(null)
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const [files, setFiles] = useState<Record<string, MediaFile[]>>({})

  const loadClients = useCallback(async () => {
    const res = await fetch('/api/clientes')
    if (!res.ok) return
    const data = await res.json()
    setClients(data.clients)
    if (data.clients.length > 0) setSelectedClient(data.clients[0].id)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    loadClients()
  }, [loadClients])

  useEffect(() => {
    if (!selectedClient) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta a lista ao trocar de cliente
    setFolders(null)
    fetch(`/api/clientes/${selectedClient}/acervo/pastas`)
      .then((res) => (res.ok ? res.json() : { folders: [] }))
      .then((data) => {
        if (!cancelled) setFolders(data.folders)
      })
    return () => {
      cancelled = true
    }
  }, [selectedClient])

  async function toggleFolder(folderId: string) {
    if (openFolder === folderId) {
      setOpenFolder(null)
      return
    }
    setOpenFolder(folderId)
    if (!files[folderId] && selectedClient) {
      const res = await fetch(`/api/clientes/${selectedClient}/acervo/pastas/${folderId}/arquivos`)
      if (res.ok) {
        const data = await res.json()
        setFiles((prev) => ({ ...prev, [folderId]: data.files }))
      }
    }
  }

  if (clients === null) return <p className="text-sm text-muted">Carregando…</p>
  if (clients.length === 0) {
    return <EmptyState icon={<FolderOpen className="size-8" />} title="Nenhum acesso configurado" />
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Acervo digital</h1>
      <p className="mt-1 text-sm text-muted">Mídias organizadas pela sua agência, prontas pra baixar.</p>

      {clients.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClient(c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                selectedClient === c.id ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {folders === null && <p className="text-sm text-muted">Carregando pastas…</p>}
        {folders !== null && folders.length === 0 && (
          <EmptyState icon={<FolderOpen className="size-8" />} title="Nenhuma pasta ainda" description="A agência ainda não organizou o acervo deste cliente." />
        )}
        {folders?.map((folder) => (
          <Card key={folder.id} className="p-0">
            <button
              onClick={() => toggleFolder(folder.id)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <Folder className="size-5 text-brand" />
              <span className="flex-1 font-medium">{folder.name}</span>
            </button>
            {openFolder === folder.id && (
              <div className="border-t border-border p-4">
                {!files[folder.id] && <p className="text-sm text-muted">Carregando arquivos…</p>}
                {files[folder.id]?.length === 0 && <p className="text-sm text-muted">Pasta vazia.</p>}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {files[folder.id]?.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-lg border border-border"
                    >
                      {file.content_type?.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={file.url} alt={file.name} className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-brand-soft text-xs text-muted">
                          {file.name}
                        </div>
                      )}
                      <div className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
                        <Download className="size-5 text-white" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
