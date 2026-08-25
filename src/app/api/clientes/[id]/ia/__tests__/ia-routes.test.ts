import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({
  clients: [],
  brand_assets: [],
  content_sources: [],
  ai_generations: [],
  content_items: [],
  activity_log: [],
  organizations: [],
  webhook_configs: [],
})

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

const generateMock = vi.fn()
const analyzeMock = vi.fn()
let configured = true
vi.mock('@/lib/anthropic', () => ({
  generateContentDraft: (...args: unknown[]) => generateMock(...args),
  analyzeContentSource: (...args: unknown[]) => analyzeMock(...args),
  isAnthropicConfigured: () => configured,
}))

let currentContext: Awaited<ReturnType<typeof import('@/lib/org').getCurrentContext>> | null = null

vi.mock('@/lib/org', () => ({
  getCurrentContext: vi.fn(async () => currentContext),
}))

function makeContext(role: Member['role']) {
  const member: Member = {
    id: 'member-1',
    user_id: 'user-1',
    org_id: 'org-1',
    role,
    display_name: 'Fulano',
    avatar_url: null,
    status: 'active',
    created_at: new Date().toISOString(),
    custom_permissions: null,
  }
  const organization: Organization = {
    id: 'org-1',
    name: 'Org',
    slug: 'org',
    logo_url: null,
    plan: 'free',
    brand_color: '#000',
    upload_post_api_key: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: null,
    current_period_end: null,
    cancel_at_period_end: false,
    trial_end: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return { userId: 'user-1', email: 'a@b.com', member, organization, permissions: getEffectivePermissions(member) }
}

const CLIENT_UUID = '123e4567-e89b-12d3-a456-426614174000'

describe('POST /api/clientes/[id]/ia/gerar', () => {
  beforeEach(() => {
    fakeSupabase.__store.clients = [{ id: CLIENT_UUID, org_id: 'org-1', name: 'Cliente', slug: 'cliente', created_at: '2026-01-01' }]
    fakeSupabase.__store.brand_assets = []
    fakeSupabase.__store.ai_generations = []
    fakeSupabase.__store.activity_log = []
    generateMock.mockReset()
    configured = true
    currentContext = makeContext('designer')
  })

  it('501 quando a IA não está configurada', async () => {
    configured = false
    const { POST } = await import('../gerar/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ client_id: CLIENT_UUID, brief: 'gerar um post legal' }) }), {
      params: Promise.resolve({ id: CLIENT_UUID }),
    })
    expect(res.status).toBe(501)
  })

  it('403 pra role=cliente (sem manageContent)', async () => {
    currentContext = makeContext('cliente')
    const { POST } = await import('../gerar/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ client_id: CLIENT_UUID, brief: 'gerar um post legal' }) }), {
      params: Promise.resolve({ id: CLIENT_UUID }),
    })
    expect(res.status).toBe(403)
  })

  it('gera e persiste o rascunho', async () => {
    generateMock.mockResolvedValue({
      success: true,
      data: { title: 'T', caption: 'C', carousel_slides: [], suggested_channels: ['instagram'] },
    })
    const { POST } = await import('../gerar/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ client_id: CLIENT_UUID, brief: 'gerar um post legal' }) }), {
      params: Promise.resolve({ id: CLIENT_UUID }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.generation.result.title).toBe('T')
    expect(fakeSupabase.__store.ai_generations).toHaveLength(1)
  })

  it('502 quando a IA falha', async () => {
    generateMock.mockResolvedValue({ success: false, error: 'timeout' })
    const { POST } = await import('../gerar/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ client_id: CLIENT_UUID, brief: 'gerar um post legal' }) }), {
      params: Promise.resolve({ id: CLIENT_UUID }),
    })
    expect(res.status).toBe(502)
  })
})

describe('POST /api/clientes/[id]/ia/rascunhos/[draftId]/aceitar', () => {
  beforeEach(() => {
    fakeSupabase.__store.ai_generations = [
      {
        id: 'draft-1',
        org_id: 'org-1',
        client_id: CLIENT_UUID,
        campaign_id: null,
        brief: 'briefing',
        result: { title: 'Gerado', caption: 'Legenda', carousel_slides: [], suggested_channels: ['instagram'] },
        content_item_id: null,
        created_at: '2026-01-01',
      },
    ]
    fakeSupabase.__store.content_items = []
    fakeSupabase.__store.activity_log = []
    fakeSupabase.__store.organizations = [{ id: 'org-1', plan: 'free', name: 'Org', created_at: '2026-01-01' }]
    fakeSupabase.__store.webhook_configs = []
    currentContext = makeContext('gestor')
  })

  it('cria o content_item e marca o rascunho como aceito', async () => {
    const { POST } = await import('../rascunhos/[draftId]/aceitar/route')
    const res = await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: CLIENT_UUID, draftId: 'draft-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.item.title).toBe('Gerado')
    expect(body.item.status).toBe('ideia')
    expect(fakeSupabase.__store.ai_generations[0].content_item_id).toBe(body.item.id)
  })

  it('rejeita aceitar o mesmo rascunho duas vezes', async () => {
    fakeSupabase.__store.ai_generations[0].content_item_id = 'content-ja-criado'
    const { POST } = await import('../rascunhos/[draftId]/aceitar/route')
    const res = await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: CLIENT_UUID, draftId: 'draft-1' }) })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/clientes/[id]/ia/fontes/[sourceId]/analisar', () => {
  beforeEach(() => {
    fakeSupabase.__store.content_sources = [
      { id: 'src-1', org_id: 'org-1', client_id: CLIENT_UUID, title: 'Ref', raw_text: 'texto de referência', analysis: null, analyzed_at: null, created_at: '2026-01-01' },
    ]
    analyzeMock.mockReset()
    configured = true
    currentContext = makeContext('designer')
  })

  it('grava a análise retornada pela IA', async () => {
    analyzeMock.mockResolvedValue({ success: true, data: { summary: 'Bom', angle_suggestions: ['a'], score: 9 } })
    const { POST } = await import('../fontes/[sourceId]/analisar/route')
    const res = await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: CLIENT_UUID, sourceId: 'src-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.source.analysis.score).toBe(9)
  })
})
