'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Error boundary do App Router — captura qualquer erro não tratado em
 * qualquer página abaixo do layout raiz e mostra isso em vez de uma tela
 * branca. `error.digest` é o que aparece nos logs do servidor (Vercel);
 * a mensagem completa nunca é exposta ao usuário aqui, por segurança.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app.error]', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="size-10 text-danger" />
      <div>
        <h1 className="text-lg font-semibold">Algo deu errado</h1>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Nossa equipe já foi avisada. Tente de novo — se o problema continuar, entre em contato com o suporte.
        </p>
        {error.digest && <p className="mt-2 text-xs text-muted">Código: {error.digest}</p>}
      </div>
      <Button onClick={reset}>Tentar de novo</Button>
    </div>
  )
}
