import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ tasks: [], activity_log: [], task_comments: [] })

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

let currentContext: Awaited<ReturnType<typeof import('@/lib/org').getCurrentContext>> | null = null

vi.mock('@/lib/org', () => ({
  getCurrentContext: vi.fn(async () => currentContext),
}))

function makeContext(role: Member['role'], orgId = 'org-1') {
  const member: Member = {
    id: 'member-1',
    user_id: 'user-1',
    org_id: orgId,
    role,
    display_name: 'Fulano',
    avatar_url: null,
    status: 'active',
    created_at: new Date().toISOString(),
    custom_permissions: null,
  }
  const organization: Organization = {
    id: orgId,
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

describe('GET/POST /api/tarefas', () => {
  beforeEach(() => {
    fakeSupabase.__store.tasks = []
    fakeSupabase.__store.activity_log = []
    currentContext = null
  })

  it('403 pra role=cliente', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(403)
  })

  it('cria tarefa com checklist', async () => {
    currentContext = makeContext('gestor')
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ title: 'Preparar briefing', checklist: [{ id: '1', text: 'Coletar referências', done: false }] }),
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.task.status).toBe('pendente')
    expect(body.task.checklist).toHaveLength(1)
  })

  it('filtra por status', async () => {
    fakeSupabase.__store.tasks = [
      { id: 't1', org_id: 'org-1', title: 'A', status: 'pendente', checklist: [], client_id: null, campaign_id: null, content_item_id: null, due_date: null, assigned_to: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 't2', org_id: 'org-1', title: 'B', status: 'concluida', checklist: [], client_id: null, campaign_id: null, content_item_id: null, due_date: null, assigned_to: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]
    currentContext = makeContext('admin')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x?status=concluida'))
    const body = await res.json()
    expect(body.tasks).toHaveLength(1)
    expect(body.tasks[0].id).toBe('t2')
  })

  it('isola por organização', async () => {
    fakeSupabase.__store.tasks = [
      { id: 't1', org_id: 'org-1', title: 'A', status: 'pendente', checklist: [], client_id: null, campaign_id: null, content_item_id: null, due_date: null, assigned_to: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 't2', org_id: 'org-OUTRA', title: 'B', status: 'pendente', checklist: [], client_id: null, campaign_id: null, content_item_id: null, due_date: null, assigned_to: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]
    currentContext = makeContext('admin')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'))
    const body = await res.json()
    expect(body.tasks).toHaveLength(1)
    expect(body.tasks[0].id).toBe('t1')
  })
})

describe('PATCH /api/tarefas/[id] — checklist e status', () => {
  beforeEach(() => {
    fakeSupabase.__store.tasks = [
      { id: 't1', org_id: 'org-1', title: 'A', status: 'pendente', checklist: [{ id: '1', text: 'Item', done: false }], client_id: null, campaign_id: null, content_item_id: null, due_date: null, assigned_to: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]
    currentContext = makeContext('designer')
  })

  it('marca item do checklist como feito e muda status', async () => {
    const { PATCH } = await import('../[id]/route')
    const res = await PATCH(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'concluida', checklist: [{ id: '1', text: 'Item', done: true }] }),
      }),
      { params: Promise.resolve({ id: 't1' }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.task.status).toBe('concluida')
    expect(body.task.checklist[0].done).toBe(true)
  })
})

describe('POST /api/tarefas/[id]/comentarios', () => {
  beforeEach(() => {
    fakeSupabase.__store.tasks = [
      { id: 't1', org_id: 'org-1', title: 'A', status: 'pendente', checklist: [], client_id: null, campaign_id: null, content_item_id: null, due_date: null, assigned_to: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]
    fakeSupabase.__store.task_comments = []
    currentContext = makeContext('designer')
  })

  it('adiciona comentário à tarefa', async () => {
    const { POST } = await import('../[id]/comentarios/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ body: 'Feito, revisar por favor' }) }), {
      params: Promise.resolve({ id: 't1' }),
    })
    expect(res.status).toBe(201)
    expect(fakeSupabase.__store.task_comments).toHaveLength(1)
  })

  it('rejeita comentário vazio', async () => {
    const { POST } = await import('../[id]/comentarios/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ body: '' }) }), {
      params: Promise.resolve({ id: 't1' }),
    })
    expect(res.status).toBe(400)
  })
})
