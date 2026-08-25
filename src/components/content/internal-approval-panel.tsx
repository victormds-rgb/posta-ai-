'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { ShieldCheck, ShieldAlert, History } from 'lucide-react'
import type { InternalApproval } from '@/lib/types'

const STATUS_TONE: Record<InternalApproval['status'], 'brand' | 'success' | 'warning'> = {
  pendente: 'brand',
  aprovado: 'success',
  ajuste: 'warning',
}
const STATUS_LABEL: Record<InternalApproval['status'], string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  ajuste: 'Ajuste solicitado',
}

/**
 * Painel de aprovação interna dentro do modal de conteúdo: solicitar
 * revisão (quem tem manageContent), aprovar/pedir ajuste (quem tem
 * approveInternal), e histórico das rodadas.
 */
export function InternalApprovalPanel({
  contentId,
  canRequest,
  canDecide,
  onChanged,
}: {
  contentId: string
  canRequest: boolean
  canDecide: boolean
  onChanged: () => void
}) {
  const [approvals, setApprovals] = useState<InternalApproval[] | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [deciding, setDeciding] = useState<'aprovado' | 'ajuste' | null>(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/conteudos/${contentId}/internal-approval`)
    if (res.ok) {
      const data = await res.json()
      setApprovals(data.approvals)
    }
  }, [contentId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  const pending = approvals?.find((a) => a.status === 'pendente') ?? null

  async function handleRequest() {
    setRequesting(true)
    setError(null)
    const res = await fetch(`/api/conteudos/${contentId}/internal-approval`, { method: 'POST' })
    setRequesting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Não foi possível solicitar aprovação.')
      return
    }
    await load()
    onChanged()
  }

  async function handleDecision(decision: 'aprovado' | 'ajuste') {
    if (decision === 'ajuste' && !comment.trim()) {
      setError('Informe o motivo do ajuste.')
      return
    }
    setDeciding(decision)
    setError(null)
    const res = await fetch(`/api/conteudos/${contentId}/internal-approval/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comment }),
    })
    setDeciding(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Não foi possível registrar a decisão.')
      return
    }
    setComment('')
    await load()
    onChanged()
  }

  if (!canRequest && !canDecide && (!approvals || approvals.length === 0)) return null

  return (
    <div className="rounded-lg border border-border bg-black/[0.02] p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Aprovação interna</p>
        {canRequest && !pending && (
          <Button type="button" size="sm" variant="secondary" loading={requesting} onClick={handleRequest}>
            <ShieldCheck className="size-3.5" />
            Solicitar aprovação
          </Button>
        )}
      </div>

      {pending && canDecide && (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            placeholder="Comentário (obrigatório se for pedir ajuste)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={deciding === 'ajuste'}
              onClick={() => handleDecision('ajuste')}
            >
              <ShieldAlert className="size-3.5" />
              Pedir ajuste
            </Button>
            <Button type="button" size="sm" loading={deciding === 'aprovado'} onClick={() => handleDecision('aprovado')}>
              <ShieldCheck className="size-3.5" />
              Aprovar
            </Button>
          </div>
        </div>
      )}

      {pending && !canDecide && (
        <p className="mt-2 text-xs text-muted">Aguardando aprovação interna de alguém com permissão pra revisar.</p>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {approvals && approvals.length > 0 && (
        <details className="mt-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
            <History className="size-3.5" />
            Histórico ({approvals.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {approvals.map((a) => (
              <li key={a.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  <span className="text-muted">{formatDateTime(a.created_at)}</span>
                </div>
                {a.requester?.display_name && (
                  <p className="mt-0.5 text-muted">Solicitado por {a.requester.display_name}</p>
                )}
                {a.reviewer?.display_name && a.status !== 'pendente' && (
                  <p className="text-muted">
                    {a.status === 'aprovado' ? 'Aprovado' : 'Revisado'} por {a.reviewer.display_name}
                  </p>
                )}
                {a.comment && <p className="mt-0.5 italic">&ldquo;{a.comment}&rdquo;</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
