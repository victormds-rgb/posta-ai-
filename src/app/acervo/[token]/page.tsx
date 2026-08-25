'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Rocket, XCircle, FolderOpen } from 'lucide-react'
import type { Client, MediaFile } from '@/lib/types'

type Data = { folder: { id: string; name: string }; client: Pick<Client, 'id' | 'name' | 'logo_url'> | null; files: MediaFile[] }

export default function PublicAcervoPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/acervo/publico/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setError('Este link não é válido ou a pasta foi removida.')
          return
        }
        setData(await res.json())
      })
      .catch(() => setError('Não foi possível carregar esta pasta.'))
  }, [token])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <XCircle className="mx-auto size-10 text-danger" />
          <p className="mt-3 text-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Rocket className="size-5 text-brand" />
        <span className="font-semibold">Posta AI</span>
      </div>

      <p className="text-sm text-muted">Acervo digital{data.client ? ` — ${data.client.name}` : ''}</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
        <FolderOpen className="size-6 text-brand" />
        {data.folder.name}
      </h1>

      {data.files.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Esta pasta ainda não tem arquivos.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {data.files.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="overflow-hidden rounded-lg border border-border"
            >
              {file.content_type?.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-surface p-2 text-center text-xs text-muted">
                  {file.name}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
