import { describe, it, expect, vi } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'

const fakeSupabase = createFakeSupabase({ organizations: [] })

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

describe('GET /api/health', () => {
  it('responde 200 status ok quando o banco responde', async () => {
    const { GET } = await import('../route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.database).toBe('ok')
  })

  it('não vaza dados de tenant no corpo da resposta', async () => {
    fakeSupabase.__store.organizations = [
      { id: 'org-1', name: 'Segredo LTDA', slug: 'segredo', created_at: '2026-01-01' },
    ]
    const { GET } = await import('../route')
    const res = await GET()
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('Segredo LTDA')
  })
})
