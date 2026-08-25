'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/card'
import { CheckCircle2, XCircle, Rocket } from 'lucide-react'
import type { ApprovalLink, Client, ContentItem } from '@/lib/types'

export default function AprovacaoPage() {
  return (
    <Suspense>
      <ApprovalView />
    </Suspense>
  )
}

type Data = { link: ApprovalLink; content: ContentItem; client: Pick<Client, 'id' | 'name' | 'logo_url'> | null }

function ApprovalView() {
  const token = useSearchParams().get('token')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewerName, setReviewerName] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState<'aprovado' | 'ajuste' | null>(null)
  const [done, setDone] = useState<'aprovado' | 'ajuste' | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/aprovacao/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error === 'expired' ? 'Este link de aprovação expirou.' : 'Link não encontrado.')
          return
        }
        setData(await res.json())
      })
      .catch(() => setError('Não foi possível carregar este link.'))
  }, [token])

  const effectiveError = error || (!token ? 'Link inválido.' : null)

  async function respond(action: 'aprovado' | 'ajuste') {
    if (!token) return
    setSubmitting(action)
    const res = await fetch(`/api/aprovacao/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewer_name: reviewerName, comment }),
    })
    setSubmitting(null)
    if (res.ok) setDone(action)
  }

  if (effectiveError) {
    return (
      <Centered>
        <XCircle className="mx-auto size-10 text-danger" />
        <p className="mt-3 text-muted">{effectiveError}</p>
      </Centered>
    )
  }

  if (done) {
    return (
      <Centered>
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h1 className="mt-3 text-xl font-semibold">
          {done === 'aprovado' ? 'Conteúdo aprovado!' : 'Ajuste solicitado'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {done === 'aprovado'
            ? 'Obrigado! A equipe já foi avisada e vai seguir com a publicação.'
            : 'Obrigado pelo retorno! A equipe vai ajustar e reenviar para aprovação.'}
        </p>
      </Centered>
    )
  }

  if (!data) {
    return (
      <Centered>
        <p className="text-muted">Carregando…</p>
      </Centered>
    )
  }

  const { content, client } = data

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Rocket className="size-5 text-brand" />
        <span className="font-semibold">Posta AI</span>
      </div>

      <p className="text-sm text-muted">Aprovação de conteúdo{client ? ` — ${client.name}` : ''}</p>
      <h1 className="mt-1 text-2xl font-bold">{content.title}</h1>

      {content.media_urls[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={content.media_urls[0]} alt="" className="mt-4 w-full rounded-xl border border-border" />
      )}

      {content.media_urls.length > 1 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {content.media_urls.slice(1).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="aspect-square rounded-lg object-cover" />
          ))}
        </div>
      )}

      {content.caption && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <p className="whitespace-pre-wrap text-sm">{content.caption}</p>
        </div>
      )}

      {content.channels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {content.channels.map((c) => (
            <Badge key={c} tone="brand" className="capitalize">
              {c}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        <div>
          <Label htmlFor="reviewer-name">Seu nome (opcional)</Label>
          <Input id="reviewer-name" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="comment">Comentário (opcional — obrigatório se for pedir ajuste)</Label>
          <Textarea id="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          loading={submitting === 'ajuste'}
          disabled={!comment.trim()}
          onClick={() => respond('ajuste')}
        >
          Pedir ajuste
        </Button>
        <Button className="flex-1" loading={submitting === 'aprovado'} onClick={() => respond('aprovado')}>
          Aprovar
        </Button>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-6 text-center">{children}</div>
}
