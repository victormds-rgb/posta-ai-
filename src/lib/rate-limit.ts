import 'server-only'
import { NextResponse } from 'next/server'

/**
 * Rate limit em memória (sliding window por contador fixo). Best-effort:
 * em ambientes serverless (ex.: Vercel) cada instância tem sua própria
 * memória, então isso NÃO é um limite global garantido — ainda assim reduz
 * abuso óbvio de uma mesma instância/IP. Para um limite realmente global,
 * seria necessário um store externo (Upstash Redis, Vercel KV) — não
 * adicionado aqui por exigir uma conta/serviço novo (ver ROADMAP.md).
 */
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
let callsSinceSweep = 0

function sweepExpired() {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSeconds?: number } {
  callsSinceSweep++
  if (callsSinceSweep > 200) {
    callsSinceSweep = 0
    sweepExpired()
  }

  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  bucket.count++
  return { ok: true }
}

/** IP do cliente a partir dos headers padrão de proxy (Vercel inclui x-forwarded-for). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

/** Resposta 429 pronta, com Retry-After. */
export function rateLimitedResponse(retryAfterSeconds?: number) {
  return NextResponse.json(
    { error: 'Muitas tentativas. Tente novamente em alguns instantes.' },
    { status: 429, headers: retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : undefined },
  )
}
