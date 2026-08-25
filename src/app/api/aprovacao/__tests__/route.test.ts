import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'

const fakeSupabase = createFakeSupabase({
  approval_links: [],
  content_items: [],
  clients: [],
  activity_log: [],
  notifications: [],
})

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: vi.fn(() => fakeSupabase),
  createServerSupabase: vi.fn(async () => fakeSupabase),
}))

const FUTURE = new Date(Date.now() + 60 * 60_000).toISOString()
const PAST = new Date(Date.now() - 60 * 60_000).toISOString()

describe('GET /api/aprovacao/[token]', () => {
  beforeEach(() => {
    fakeSupabase.__store.approval_links = [
      { id: 'link-valid', content_id: 'content-1', org_id: 'org-1', token: 'tok-valido', status: 'pendente', expires_at: FUTURE, created_at: '2026-01-01' },
      { id: 'link-expired', content_id: 'content-1', org_id: 'org-1', token: 'tok-expirado', status: 'pendente', expires_at: PAST, created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.content_items = [
      { id: 'content-1', org_id: 'org-1', client_id: 'client-1', title: 'Conteúdo', media_urls: [], channels: [], status: 'aprovacao_cliente', created_by: 'user-1', assigned_to: null, created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.clients = [{ id: 'client-1', org_id: 'org-1', name: 'Cliente', slug: 'cliente', created_at: '2026-01-01' }]
  })

  it('retorna 404 pra token inexistente', async () => {
    const { GET } = await import('../[token]/route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ token: 'token-que-nao-existe' }) })
    expect(res.status).toBe(404)
  })

  it('retorna 410 pra token expirado', async () => {
    const { GET } = await import('../[token]/route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ token: 'tok-expirado' }) })
    expect(res.status).toBe(410)
  })

  it('retorna o conteúdo pra token válido', async () => {
    const { GET } = await import('../[token]/route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ token: 'tok-valido' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.content.id).toBe('content-1')
    expect(body.client.name).toBe('Cliente')
  })
})

describe('POST /api/aprovacao/[token] — decisão do cliente', () => {
  beforeEach(() => {
    fakeSupabase.__store.approval_links = [
      { id: 'link-valid', content_id: 'content-1', org_id: 'org-1', token: 'tok-valido', status: 'pendente', expires_at: FUTURE, created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.content_items = [
      { id: 'content-1', org_id: 'org-1', client_id: 'client-1', title: 'Conteúdo', media_urls: [], channels: [], status: 'aprovacao_cliente', created_by: 'user-1', assigned_to: null, created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.activity_log = []
    fakeSupabase.__store.notifications = []
  })

  it('rejeita payload com action inválida (validação de entrada)', async () => {
    const { POST } = await import('../[token]/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'talvez' }) }), {
      params: Promise.resolve({ token: 'tok-valido' }),
    })
    expect(res.status).toBe(400)
  })

  it('aprovar move o conteúdo pra "agendado" e notifica quem criou', async () => {
    const { POST } = await import('../[token]/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'aprovado' }) }), {
      params: Promise.resolve({ token: 'tok-valido' }),
    })
    expect(res.status).toBe(200)
    const content = fakeSupabase.__store.content_items.find((c) => c.id === 'content-1')
    expect(content?.status).toBe('agendado')
    const link = fakeSupabase.__store.approval_links.find((l) => l.id === 'link-valid')
    expect(link?.status).toBe('aprovado')
    expect(fakeSupabase.__store.notifications).toHaveLength(1)
    expect(fakeSupabase.__store.notifications[0].user_id).toBe('user-1')
  })

  it('pedir ajuste move o conteúdo de volta pra "producao"', async () => {
    const { POST } = await import('../[token]/route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'ajuste', comment: 'Trocar a imagem' }) }),
      { params: Promise.resolve({ token: 'tok-valido' }) },
    )
    expect(res.status).toBe(200)
    const content = fakeSupabase.__store.content_items.find((c) => c.id === 'content-1')
    expect(content?.status).toBe('producao')
  })

  it('token inexistente retorna 404 e não altera nada', async () => {
    const { POST } = await import('../[token]/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'aprovado' }) }), {
      params: Promise.resolve({ token: 'nao-existe' }),
    })
    expect(res.status).toBe(404)
    const content = fakeSupabase.__store.content_items.find((c) => c.id === 'content-1')
    expect(content?.status).toBe('aprovacao_cliente')
  })
})
