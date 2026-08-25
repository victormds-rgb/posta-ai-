'use client'

import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'

export function ClientFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, notes }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Não foi possível criar o cliente.')
      return
    }
    setName('')
    setContact('')
    setNotes('')
    onCreated()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo cliente">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="client-name">Nome</Label>
          <Input id="client-name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <Label htmlFor="client-contact">Contato (telefone/e-mail)</Label>
          <Input id="client-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-notes">Notas</Label>
          <Textarea id="client-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Criar cliente
          </Button>
        </div>
      </form>
    </Modal>
  )
}
