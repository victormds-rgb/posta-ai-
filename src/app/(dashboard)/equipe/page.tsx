'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Badge } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input, Label } from '@/components/ui/input'
import type { Invite, Member, UserRole } from '@/lib/types'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  designer: 'Designer',
  cliente: 'Cliente',
}

export default function EquipePage() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/equipe')
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members)
      setInvites(data.invites)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-sm text-muted">Membros e convites pendentes da organização.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="size-4" />
          Convidar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : (
        <div className="space-y-6">
          <Card className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{m.display_name || m.email || 'Sem nome'}</p>
                  <p className="text-xs text-muted">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="brand">{ROLE_LABELS[m.role]}</Badge>
                  {m.status !== 'active' && <Badge tone="warning">{m.status}</Badge>}
                </div>
              </div>
            ))}
          </Card>

          {invites.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">Convites pendentes</h2>
              <Card className="divide-y divide-border">
                {invites.map((i) => (
                  <div key={i.id} className="flex items-center justify-between p-4">
                    <p className="text-sm">{i.email}</p>
                    <Badge>{ROLE_LABELS[i.role]}</Badge>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}

      <InviteModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </div>
  )
}

function InviteModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('designer')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/equipe/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    setLoading(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível criar o convite.')
      return
    }
    setLink(data.link)
    onCreated()
  }

  function handleClose() {
    setEmail('')
    setRole('designer')
    setLink(null)
    setError(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Convidar para a equipe">
      {link ? (
        <div>
          <p className="text-sm text-muted">
            Convite criado! Envie este link para <strong>{email}</strong>:
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input readOnly value={link} className="text-xs" onFocus={(e) => e.target.select()} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(link)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <Button className="mt-4 w-full" variant="secondary" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="invite-email">E-mail</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="invite-role">Papel</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button loading={loading} onClick={handleSubmit}>
              Gerar convite
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
