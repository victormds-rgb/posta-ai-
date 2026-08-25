'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Share2, Copy, Check, Loader2, Upload, Folder, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { usePermissions } from '@/hooks/use-permissions'
import { GoogleDriveImportModal } from '@/components/acervo/google-drive-import-modal'
import type { Client, MediaFile, MediaFolder } from '@/lib/types'

export default function AcervoPage() {
  const { slug } = useParams<{ slug: string }>()
  const { permissions } = usePermissions()
  const canManage = permissions?.manageMedia ?? false

  const [client, setClient] = useState<Client | null>(null)
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const [files, setFiles] = useState<Record<string, MediaFile[]>>({})

  const load = useCallback(async () => {
    const clientsRes = await fetch('/api/clientes')
    if (!clientsRes.ok) return
    const { clients } = await clientsRes.json()
    const found: Client | undefined = clients.find((c: Client) => c.slug === slug)
    setClient(found ?? null)
    if (found) {
      const foldersRes = await fetch(`/api/clientes/${found.id}/acervo/pastas`)
      if (foldersRes.ok) {
        const data = await foldersRes.json()
        setFolders(data.folders)
      }
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function reloadFiles(folderId: string) {
    if (!client) return
    const res = await fetch(`/api/clientes/${client.id}/acervo/pastas/${folderId}/arquivos`)
    if (res.ok) {
      const data = await res.json()
      setFiles((prev) => ({ ...prev, [folderId]: data.files }))
    }
  }

  async function toggleFolder(folderId: string) {
    if (openFolder === folderId) {
      setOpenFolder(null)
      return
    }
    setOpenFolder(folderId)
    if (!files[folderId]) await reloadFiles(folderId)
  }

  async function togglePublic(folder: MediaFolder) {
    if (!client) return
    const res = await fetch(`/api/clientes/${client.id}/acervo/pastas/${folder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public: !folder.public_token }),
    })
    if (res.ok) {
      const { folder: updated } = await res.json()
      setFolders((prev) => prev.map((f) => (f.id === folder.id ? updated : f)))
    }
  }

  async function deleteFolder(folderId: string) {
    if (!client) return
    if (!confirm('Excluir esta pasta e todos os arquivos dentro dela?')) return
    const res = await fetch(`/api/clientes/${client.id}/acervo/pastas/${folderId}`, { method: 'DELETE' })
    if (res.ok) setFolders((prev) => prev.filter((f) => f.id !== folderId))
  }

  async function deleteFile(folderId: string, fileId: string) {
    const res = await fetch(`/api/acervo/arquivos/${fileId}`, { method: 'DELETE' })
    if (res.ok) setFiles((prev) => ({ ...prev, [folderId]: prev[folderId].filter((f) => f.id !== fileId) }))
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>
  if (!client) return <p className="text-sm text-muted">Cliente não encontrado.</p>

  return (
    <div>
      <Link href={`/clientes/${client.slug}`} className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar para {client.name}
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Acervo digital — {client.name}</h1>
          <p className="mt-1 text-sm text-muted">Organize mídias em pastas e compartilhe por link quando precisar.</p>
        </div>
        {canManage && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />
            Nova pasta
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {folders.length === 0 && (
          <EmptyState icon={<Folder className="size-8" />} title="Nenhuma pasta ainda" description="Crie uma pasta para começar a organizar o acervo deste cliente." />
        )}
        {folders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            open={openFolder === folder.id}
            files={files[folder.id]}
            canManage={canManage}
            onToggle={() => toggleFolder(folder.id)}
            onTogglePublic={() => togglePublic(folder)}
            onDelete={() => deleteFolder(folder.id)}
            onDeleteFile={(fileId) => deleteFile(folder.id, fileId)}
            onUploaded={() => reloadFiles(folder.id)}
            clientId={client.id}
          />
        ))}
      </div>

      <NewFolderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(folder) => {
          setFolders((prev) => [folder, ...prev])
          setModalOpen(false)
        }}
        clientId={client.id}
      />
    </div>
  )
}

function FolderRow({
  folder,
  open,
  files,
  canManage,
  onToggle,
  onTogglePublic,
  onDelete,
  onDeleteFile,
  onUploaded,
  clientId,
}: {
  folder: MediaFolder
  open: boolean
  files: MediaFile[] | undefined
  canManage: boolean
  onToggle: () => void
  onTogglePublic: () => void
  onDelete: () => void
  onDeleteFile: (fileId: string) => void
  onUploaded: () => void
  clientId: string
}) {
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [driveModalOpen, setDriveModalOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const publicUrl = folder.public_token ? `${origin}/acervo/${folder.public_token}` : null

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    for (const file of Array.from(fileList)) {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json().catch(() => ({}))
      if (!uploadRes.ok) continue
      await fetch(`/api/clientes/${clientId}/acervo/pastas/${folder.id}/arquivos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, url: uploadData.url, content_type: file.type, size_bytes: file.size }),
      })
    }
    setUploading(false)
    onUploaded()
  }

  return (
    <Card className="p-0">
      <div className="flex items-center gap-3 p-4">
        <button onClick={onToggle} className="flex flex-1 items-center gap-3 text-left">
          <Folder className="size-5 text-brand" />
          <span className="font-medium">{folder.name}</span>
        </button>
        {canManage && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant={folder.public_token ? 'secondary' : 'ghost'} onClick={onTogglePublic} title="Link público">
              <Share2 className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} title="Excluir pasta">
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {publicUrl && (
        <div className="flex items-center gap-2 border-t border-border bg-brand-soft px-4 py-2 text-xs">
          <span className="truncate text-brand">{publicUrl}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(publicUrl)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="shrink-0"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      )}

      {open && (
        <div className="border-t border-border p-4">
          {canManage && (
            <div className="mb-3 flex gap-2">
              <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
              <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
                <Upload className="size-4" />
                Enviar arquivos
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDriveModalOpen(true)}>
                <HardDrive className="size-4" />
                Importar do Drive
              </Button>
            </div>
          )}
          <GoogleDriveImportModal
            open={driveModalOpen}
            onClose={() => setDriveModalOpen(false)}
            folderId={folder.id}
            onImported={onUploaded}
          />
          {!files && <p className="text-sm text-muted">Carregando…</p>}
          {files?.length === 0 && <p className="text-sm text-muted">Pasta vazia.</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {files?.map((file) => (
              <div key={file.id} className="group relative overflow-hidden rounded-lg border border-border">
                {file.content_type?.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt={file.name} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-brand-soft p-2 text-center text-xs text-muted">
                    {file.name}
                  </div>
                )}
                {canManage && (
                  <button
                    onClick={() => onDeleteFile(file.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function NewFolderModal({
  open,
  onClose,
  onCreated,
  clientId,
}: {
  open: boolean
  onClose: () => void
  onCreated: (folder: MediaFolder) => void
  clientId: string
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/clientes/${clientId}/acervo/pastas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setLoading(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível criar a pasta.')
      return
    }
    setName('')
    onCreated(data.folder)
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova pasta">
      <div className="space-y-4">
        <div>
          <Label htmlFor="folder-name">Nome</Label>
          <Input id="folder-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} disabled={!name.trim()} onClick={handleSubmit}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Criar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
