'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FileIcon, Loader2 } from 'lucide-react'
import type { GoogleDriveFile } from '@/lib/google-drive'

export function GoogleDriveImportModal({
  open,
  onClose,
  folderId,
  onImported,
}: {
  open: boolean
  onClose: () => void
  folderId: string
  onImported: () => void
}) {
  const [files, setFiles] = useState<GoogleDriveFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta a listagem ao abrir o modal
    setFiles(null)
    setError(null)
    fetch('/api/google-drive/arquivos')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Não foi possível listar os arquivos do Drive.')
          return
        }
        setFiles(data.files)
      })
      .catch(() => setError('Não foi possível listar os arquivos do Drive.'))
  }, [open])

  async function handleImport(fileId: string) {
    setImportingId(fileId)
    const res = await fetch('/api/google-drive/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, folder_id: folderId }),
    })
    setImportingId(null)
    if (res.ok) {
      onImported()
      onClose()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Falha ao importar.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar do Google Drive">
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {!error && files === null && <p className="text-sm text-muted">Carregando…</p>}
      {!error && files?.length === 0 && <p className="text-sm text-muted">Nenhum arquivo encontrado no Drive.</p>}
      <div className="max-h-96 space-y-1.5 overflow-y-auto">
        {files?.map((file) => (
          <button
            key={file.id}
            onClick={() => handleImport(file.id)}
            disabled={importingId === file.id}
            className="flex w-full items-center gap-2 rounded-lg border border-border p-2.5 text-left text-sm hover:bg-brand-soft disabled:opacity-60"
          >
            {importingId === file.id ? <Loader2 className="size-4 animate-spin" /> : <FileIcon className="size-4 text-muted" />}
            <span className="truncate">{file.name}</span>
          </button>
        ))}
      </div>
      <Button variant="secondary" className="mt-4 w-full" onClick={onClose}>
        Fechar
      </Button>
    </Modal>
  )
}
