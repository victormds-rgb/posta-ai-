import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'

const fakeSupabase = createFakeSupabase({ media_folders: [], media_files: [], clients: [] })

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: vi.fn(() => fakeSupabase),
  createServerSupabase: vi.fn(async () => fakeSupabase),
}))

describe('GET /api/acervo/publico/[token]', () => {
  beforeEach(() => {
    fakeSupabase.__store.media_folders = [
      { id: 'f1', org_id: 'org-1', client_id: 'c1', name: 'Compartilhada', public_token: 'tok-publico', created_at: '2026-01-01' },
      { id: 'f2', org_id: 'org-1', client_id: 'c1', name: 'Privada', public_token: null, created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.clients = [{ id: 'c1', org_id: 'org-1', name: 'Cliente', slug: 'cliente', created_at: '2026-01-01' }]
    fakeSupabase.__store.media_files = [
      { id: 'file-1', org_id: 'org-1', folder_id: 'f1', name: 'foto.jpg', url: 'https://x/foto.jpg', content_type: 'image/jpeg', size_bytes: 100, created_by: null, created_at: '2026-01-01' },
    ]
  })

  it('404 pra token inexistente', async () => {
    const { GET } = await import('../[token]/route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ token: 'nao-existe' }) })
    expect(res.status).toBe(404)
  })

  it('retorna a pasta e os arquivos pra um token válido, sem exigir login', async () => {
    const { GET } = await import('../[token]/route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ token: 'tok-publico' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.folder.name).toBe('Compartilhada')
    expect(body.client.name).toBe('Cliente')
    expect(body.files).toHaveLength(1)
  })

  it('uma pasta sem public_token não é acessível por nenhum token', async () => {
    const { GET } = await import('../[token]/route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ token: '' }) })
    expect(res.status).toBe(404)
  })
})
