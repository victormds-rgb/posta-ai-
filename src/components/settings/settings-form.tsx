'use client'

import { useState, type FormEvent } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import type { Organization } from '@/lib/types'

export function SettingsForm({ organization, canEdit }: { organization: Organization; canEdit: boolean }) {
  const [name, setName] = useState(organization.name)
  const [brandColor, setBrandColor] = useState(organization.brand_color)
  const [uploadPostKey, setUploadPostKey] = useState(organization.upload_post_api_key || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    const res = await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, brand_color: brandColor, upload_post_api_key: uploadPostKey }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Não foi possível salvar.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
            do servidor (se configurado).
          </p>
        </div>
        <div>
          <Label htmlFor="org-upload-post-key">Chave da API</Label>
          <Input
            id="org-upload-post-key"
            type="password"
            disabled={!canEdit}
            value={uploadPostKey}
            onChange={(e) => setUploadPostKey(e.target.value)}
            placeholder="upk_..."
          />
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
