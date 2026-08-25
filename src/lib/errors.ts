import 'server-only'
import { NextResponse } from 'next/server'

/**
 * Responde 500 sem vazar detalhes internos (nome de coluna/constraint do
 * Postgres, stack trace, etc.) — loga o erro real no servidor (Vercel
 * captura `console.error`) e devolve uma mensagem genérica ao cliente.
 * Em desenvolvimento, devolve a mensagem real pra facilitar debug local.
 */
export function serverError(error: unknown, context: string, fallback = 'Erro interno. Tente novamente.') {
  console.error(`[${context}]`, error)
  const message = error instanceof Error ? error.message : String(error)
  const isProd = process.env.NODE_ENV === 'production'
  return NextResponse.json({ error: isProd ? fallback : message }, { status: 500 })
}
