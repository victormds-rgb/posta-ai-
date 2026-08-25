import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const lookupMock = vi.fn()
vi.mock('node:dns/promises', () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}))

const fetchMock = vi.fn()
const originalFetch = global.fetch

const { wpTestConnection, wpCreatePost } = await import('@/lib/wordpress')

describe('wpTestConnection / wpCreatePost — proteção SSRF', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    lookupMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('rejeita site_url apontando pra localhost, sem chegar a fazer fetch', async () => {
    const result = await wpTestConnection('http://localhost:1337', 'admin', 'senha')
    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejeita site_url que resolve pra um IP privado (evita bypass por DNS)', async () => {
    lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    const result = await wpCreatePost('https://blog-interno.exemplo.com', 'admin', 'senha', { title: 'X', content: 'Y' })
    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('permite um site_url público de verdade', async () => {
    lookupMock.mockResolvedValue([{ address: '203.0.113.10', family: 4 }])
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1, name: 'Admin' }) })
    const result = await wpTestConnection('https://blog.cliente.com', 'admin', 'senha')
    expect(result.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
