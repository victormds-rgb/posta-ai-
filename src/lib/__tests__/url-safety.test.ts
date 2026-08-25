import { describe, it, expect, vi } from 'vitest'

const lookupMock = vi.fn()
vi.mock('node:dns/promises', () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}))

const { assertPublicUrl } = await import('@/lib/url-safety')

describe('assertPublicUrl', () => {
  it('rejeita URL malformada', async () => {
    const result = await assertPublicUrl('não é uma url')
    expect(result.ok).toBe(false)
  })

  it('rejeita protocolo que não é http/https', async () => {
    const result = await assertPublicUrl('ftp://exemplo.com/arquivo')
    expect(result.ok).toBe(false)
  })

  it('rejeita localhost', async () => {
    const result = await assertPublicUrl('http://localhost:3000/webhook')
    expect(result.ok).toBe(false)
  })

  it('rejeita IP literal de loopback', async () => {
    const result = await assertPublicUrl('http://127.0.0.1:8080/webhook')
    expect(result.ok).toBe(false)
  })

  it('rejeita IP literal de rede privada (10.x, 192.168.x, 172.16-31.x)', async () => {
    for (const ip of ['10.0.0.5', '192.168.1.1', '172.20.0.1']) {
      const result = await assertPublicUrl(`http://${ip}/webhook`)
      expect(result.ok).toBe(false)
    }
  })

  it('rejeita o endereço de metadata da nuvem (169.254.169.254)', async () => {
    const result = await assertPublicUrl('http://169.254.169.254/latest/meta-data/')
    expect(result.ok).toBe(false)
  })

  it('rejeita IPv6 loopback e unique-local', async () => {
    expect((await assertPublicUrl('http://[::1]/webhook')).ok).toBe(false)
    expect((await assertPublicUrl('http://[fd00::1]/webhook')).ok).toBe(false)
  })

  it('aceita IP público literal', async () => {
    const result = await assertPublicUrl('http://8.8.8.8/webhook')
    expect(result.ok).toBe(true)
  })

  it('resolve o hostname e rejeita se ele apontar pra um IP interno (evita bypass por DNS)', async () => {
    lookupMock.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    const result = await assertPublicUrl('https://dominio-que-resolve-pra-dentro.com/webhook')
    expect(result.ok).toBe(false)
  })

  it('resolve o hostname e aceita se ele apontar pra um IP público', async () => {
    lookupMock.mockResolvedValue([{ address: '203.0.113.10', family: 4 }])
    const result = await assertPublicUrl('https://exemplo.com/webhook')
    expect(result.ok).toBe(true)
  })

  it('rejeita quando o domínio não resolve', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'))
    const result = await assertPublicUrl('https://nao-existe.invalid/webhook')
    expect(result.ok).toBe(false)
  })
})
