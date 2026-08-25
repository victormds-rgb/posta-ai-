'use client'

import { useState, type FormEvent } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

export function SettingsForm({
  name: initialName,
  brandColor: initialBrandColor,
  hasUploadPostKey: initialHasKey,
  canEdit,
}: {
  name: string
  brandColor: string
  /** Nunca recebemos a chave real do servidor — só se ela está configurada. */
  hasUploadPostKey: boolean
  canEdit: boolean
}) {
  const [name, setName] = useState(initialName)
  const [brandColor, setBrandColor] = useState(initialBrandColor)
  const [uploadPostKey, setUploadPostKey] = useState('')
  const [hasUploadPostKey, setHasUploadPostKey] = useState(initialHasKey)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(body: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    setSaved(false)
    const res = await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Não foi possível salvar.')
      return false
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = { name, brand_color: brandColor }
    // Só manda a chave se o usuário digitou uma nova — em branco mantém a atual.
    if (uploadPostKey.trim()) body.upload_post_api_key = uploadPostKey.trim()
    const ok = await save(body)
    if (ok && uploadPostKey.trim()) {
      setHasUploadPostKey(true)
      setUploadPostKey('')
    }
  }

  async function handleRemoveKey() {
    if (!confirm('Remover a chave da Upload-Post desta organização? Volta a usar o fallback do servidor, se houver.')) {
      return
    }
    const ok = await save({ upload_post_api_key: null })
    if (ok) setHasUploadPostKey(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      <Card className="space-y-4 p-5">
        <div>
          <Label htmlFor="org-name">Nome da organização</Label>
          <Input id="org-name" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="org-color">Cor da marca</Label>
          <div className="flex items-center gap-2">
            <input
              id="org-color"
              type="color"
              disabled={!canEdit}
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-10 w-14 rounded-md border border-border bg-surface"
            />
            <Input value={brandColor} disabled={!canEdit} onChange={(e) => setBrandColor(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div>
          <p className="font-medium">Upload-Post</p>
          <p className="text-sm text-muted">
            Chave da API usada para conectar redes sociais e publicar conteúdo. Sem chave própria, usamos o fallback
            do servidor (se configurado). Por segurança, a chave salva nunca é reexibida — só é possível substituir
            ou remover.
          </p>
        </div>
        <div>
          <Label htmlFor="org-upload-post-key">{hasUploadPostKey ? 'Substituir chave' : 'Chave da API'}</Label>
          <Input
            id="org-upload-post-key"
            type="password"
            disabled={!canEdit}
            value={uploadPostKey}
            onChange={(e) => setUploadPostKey(e.target.value)}
            placeholder={hasUploadPostKey ? '•••••••••••••• (configurada)' : 'upk_...'}
          />
          {hasUploadPostKey && canEdit && (
            <button type="button" onClick={handleRemoveKey} className="mt-1.5 text-xs text-danger hover:underline">
              Remover chave configurada
            </button>
          )}
        </div>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}
      {canEdit && (
        <Button type="submit" loading={saving}>
          {saved ? 'Salvo!' : 'Salvar alterações'}
        </Button>
      )}
    </form>
  )
}
