import { describe, it, expect, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { assertWithinClientLimit, assertWithinContentLimit } from '@/lib/plan-limits'

describe('assertWithinClientLimit', () => {
  const supabase = createFakeSupabase({ clients: [] })

  beforeEach(() => {
    supabase.__store.clients = []
  })

  it('permite criar no plano free até o limite (1 cliente)', async () => {
    const result = await assertWithinClientLimit(supabase as never, 'org-1', 'free')
    expect(result.ok).toBe(true)
  })

  it('bloqueia no plano free ao atingir o limite', async () => {
    supabase.__store.clients = [{ id: 'c1', org_id: 'org-1', created_at: '2026-01-01' }]
    const result = await assertWithinClientLimit(supabase as never, 'org-1', 'free')
    expect(result.ok).toBe(false)
  })

  it('não conta clientes de outra organização', async () => {
    supabase.__store.clients = [{ id: 'c1', org_id: 'org-OUTRA', created_at: '2026-01-01' }]
    const result = await assertWithinClientLimit(supabase as never, 'org-1', 'free')
    expect(result.ok).toBe(true)
  })

  it('plano agency não tem limite', async () => {
    supabase.__store.clients = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, org_id: 'org-1', created_at: '2026-01-01' }))
    const result = await assertWithinClientLimit(supabase as never, 'org-1', 'agency')
    expect(result.ok).toBe(true)
  })

  it('plano desconhecido cai no limite do free', async () => {
    supabase.__store.clients = [{ id: 'c1', org_id: 'org-1', created_at: '2026-01-01' }]
    const result = await assertWithinClientLimit(supabase as never, 'org-1', 'plano-que-nao-existe')
    expect(result.ok).toBe(false)
  })
})

describe('assertWithinContentLimit', () => {
  const supabase = createFakeSupabase({ content_items: [] })

  beforeEach(() => {
    supabase.__store.content_items = []
  })

  it('bloqueia no plano free ao atingir 5 conteúdos no mês', async () => {
    const now = new Date().toISOString()
    supabase.__store.content_items = Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, org_id: 'org-1', created_at: now }))
    const result = await assertWithinContentLimit(supabase as never, 'org-1', 'free')
    expect(result.ok).toBe(false)
  })

  it('não conta conteúdo criado em mês anterior', async () => {
    supabase.__store.content_items = Array.from({ length: 5 }, (_, i) => ({
      id: `x${i}`,
      org_id: 'org-1',
      created_at: '2020-01-01T00:00:00.000Z',
    }))
    const result = await assertWithinContentLimit(supabase as never, 'org-1', 'free')
    expect(result.ok).toBe(true)
  })
})
