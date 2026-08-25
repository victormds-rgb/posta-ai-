'use client'

import { useEffect } from 'react'

/**
 * Captura erros que acontecem no próprio layout raiz (fora do alcance de
 * error.tsx) — precisa renderizar <html>/<body> do zero, já que substitui
 * o layout raiz inteiro quando dispara. Caso raro, mas exigido pelo
 * App Router pra não sobrar tela branca sem fallback nenhum.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app.global-error]', error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '0 1.5rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Algo deu errado</h1>
          <p style={{ maxWidth: '24rem', fontSize: '0.875rem', color: '#666' }}>
            Nossa equipe já foi avisada. Recarregue a página — se o problema continuar, entre em contato com o suporte.
          </p>
          {error.digest && <p style={{ fontSize: '0.75rem', color: '#999' }}>Código: {error.digest}</p>}
          <button
            onClick={reset}
            style={{ borderRadius: '0.5rem', padding: '0.5rem 1rem', background: '#6366F1', color: 'white', fontSize: '0.875rem', fontWeight: 500 }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  )
}
