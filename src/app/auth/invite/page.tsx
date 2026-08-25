'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  designer: 'Designer',
  cliente: 'Cliente',
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteView />
    </Suspense>
  )
}

function InviteView() {
  const router = useRouter()
  const token = useSearchParams().get('token')
  const [invite, setInvite] = useState<{ email: string; role: string; org_name?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(
            body.error === 'expired'
              ? 'Este convite expirou.'
              : body.error === 'already_accepted'
                ? 'Este convite já foi utilizado.'
                : 'Convite não encontrado.',
          )
          return
        }
        setInvite(await res.json())
      })
      .catch(() => setError('Não foi possível carregar o convite.'))

    createClient()
      .auth.getUser()
      .then(({ data }) => setHasSession(!!data.user))
  }, [token])

  async function acceptAndRedirect() {
    const res = await fetch('/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível aceitar o convite.')
      return
    }
    router.replace('/clientes')
    router.refresh()
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    if (!invite) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: name, invited_org_id: 'pending' } },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (!data.session) {
      setError('Confirme seu e-mail e volte a este link para concluir o convite.')
      return
    }
    await acceptAndRedirect()
  }

  const effectiveError = error || (!token ? 'Link de convite inválido.' : null)

  if (effectiveError) {
    return (
      <Centered>
        <p className="text-danger">{effectiveError}</p>
        <Link href="/login" className="mt-3 inline-block text-sm text-brand hover:underline">
          Ir para o login
        </Link>
      </Centered>
    )
  }

  if (!invite || hasSession === null) {
    return (
      <Centered>
        <p className="text-muted">Carregando…</p>
      </Centered>
    )
  }

  if (hasSession) {
    return (
      <Centered>
        <h1 className="text-xl font-bold">Entrar em {invite.org_name || 'organização'}</h1>
        <p className="mt-2 text-sm text-muted">
          Você foi convidado como <strong>{ROLE_LABELS[invite.role] || invite.role}</strong>.
        </p>
        <Button className="mt-5" onClick={acceptAndRedirect}>
          Aceitar convite
        </Button>
      </Centered>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Você foi convidado!</h1>
        <p className="mt-1 text-sm text-muted">
          Crie sua conta para entrar em <strong>{invite.org_name || 'organização'}</strong> como{' '}
          {ROLE_LABELS[invite.role] || invite.role}.
        </p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="invite-name">Seu nome</Label>
            <Input id="invite-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="invite-email">E-mail</Label>
            <Input id="invite-email" value={invite.email} disabled />
          </div>
          <div>
            <Label htmlFor="invite-password">Senha</Label>
            <Input
              id="invite-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Criar conta e entrar
          </Button>
        </form>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">{children}</div>
}
