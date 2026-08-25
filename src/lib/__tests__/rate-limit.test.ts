import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('permite até o limite e bloqueia depois, na mesma janela', () => {
    const key = `test-${crypto.randomUUID()}`
    let allowed = 0
    let blocked = 0
    for (let i = 0; i < 15; i++) {
      const result = rateLimit(key, 10, 60_000)
      if (result.ok) allowed++
      else blocked++
    }
    expect(allowed).toBe(10)
    expect(blocked).toBe(5)
  })

  it('chaves diferentes têm contadores independentes', () => {
    const keyA = `a-${crypto.randomUUID()}`
    const keyB = `b-${crypto.randomUUID()}`
    for (let i = 0; i < 5; i++) rateLimit(keyA, 5, 60_000)
    expect(rateLimit(keyA, 5, 60_000).ok).toBe(false)
    expect(rateLimit(keyB, 5, 60_000).ok).toBe(true)
  })

  it('retorna retryAfterSeconds quando bloqueado', () => {
    const key = `retry-${crypto.randomUUID()}`
    rateLimit(key, 1, 60_000)
    const blocked = rateLimit(key, 1, 60_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('libera novamente depois que a janela expira', async () => {
    const key = `window-${crypto.randomUUID()}`
    expect(rateLimit(key, 1, 30).ok).toBe(true)
    expect(rateLimit(key, 1, 30).ok).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(rateLimit(key, 1, 30).ok).toBe(true)
  })
})

describe('getClientIp', () => {
  it('usa o primeiro IP de x-forwarded-for', () => {
    const request = new Request('http://localhost', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
    expect(getClientIp(request)).toBe('1.2.3.4')
  })

  it('cai pra x-real-ip quando não há x-forwarded-for', () => {
    const request = new Request('http://localhost', { headers: { 'x-real-ip': '9.9.9.9' } })
    expect(getClientIp(request)).toBe('9.9.9.9')
  })

  it('retorna "unknown" sem nenhum header', () => {
    const request = new Request('http://localhost')
    expect(getClientIp(request)).toBe('unknown')
  })
})
