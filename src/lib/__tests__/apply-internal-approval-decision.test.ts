import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: vi.fn(() => fakeSupabase),
  createServerSupabase: vi.fn(async () => fakeSupabase),
}))

const fakeSupabase = createFakeSupabase({
  content_items: [],
  internal_approvals: [],
  activity_log: [],
  notifications: [],
})

describe('applyInternalApprovalDecision', () => {
  beforeEach(() => {
    fakeSupabase.__store.content_items = [
      { id: 'content-1', org_id: 'org-1', title: 'Post X', client_id: 'client-1', status: 'aprovacao_interna', media_urls: [], channels: [], created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.internal_approvals = [
      { id: 'approval-1', content_id: 'content-1', org_id: 'org-1', status: 'pendente', requested_by: 'user-requester', created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.activity_log = []
    fakeSupabase.__store.notifications = []
  })

  it('aprova e move o conteúdo pra aprovacao_cliente', async () => {
    const { applyInternalApprovalDecision } = await import('@/lib/approvals')
    const result = await applyInternalApprovalDecision(fakeSupabase as never, {
      contentId: 'content-1',
      orgId: 'org-1',
      decision: 'aprovado',
      reviewedBy: 'user-reviewer',
    })
    expect(result.ok).toBe(true)
    const content = fakeSupabase.__store.content_items.find((c) => c.id === 'content-1')
    expect(content?.status).toBe('aprovacao_cliente')
    const approval = fakeSupabase.__store.internal_approvals.find((a) => a.id === 'approval-1')
    expect(approval?.status).toBe('aprovado')
    expect(approval?.reviewed_by).toBe('user-reviewer')
    expect(fakeSupabase.__store.notifications).toHaveLength(1)
    expect(fakeSupabase.__store.notifications[0].user_id).toBe('user-requester')
  })

  it('pede ajuste e move o conteúdo de volta pra producao, guardando o comentário', async () => {
    const { applyInternalApprovalDecision } = await import('@/lib/approvals')
    const result = await applyInternalApprovalDecision(fakeSupabase as never, {
      contentId: 'content-1',
      orgId: 'org-1',
      decision: 'ajuste',
      comment: 'Trocar a legenda',
      reviewedBy: null, // ex.: veio de um clique de botão no Telegram, sem usuário do app associado
    })
    expect(result.ok).toBe(true)
    const content = fakeSupabase.__store.content_items.find((c) => c.id === 'content-1')
    expect(content?.status).toBe('producao')
    const approval = fakeSupabase.__store.internal_approvals.find((a) => a.id === 'approval-1')
    expect(approval?.comment).toBe('Trocar a legenda')
    expect(approval?.reviewed_by).toBeNull()
  })

  it('retorna erro quando não há aprovação pendente pro conteúdo', async () => {
    fakeSupabase.__store.internal_approvals = []
    const { applyInternalApprovalDecision } = await import('@/lib/approvals')
    const result = await applyInternalApprovalDecision(fakeSupabase as never, {
      contentId: 'content-1',
      orgId: 'org-1',
      decision: 'aprovado',
      reviewedBy: 'user-reviewer',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(404)
  })

  it('não decide sobre um conteúdo de outra organização (isolamento multi-tenant)', async () => {
    const { applyInternalApprovalDecision } = await import('@/lib/approvals')
    const result = await applyInternalApprovalDecision(fakeSupabase as never, {
      contentId: 'content-1',
      orgId: 'org-DE-OUTRO-TIME',
      decision: 'aprovado',
      reviewedBy: 'user-reviewer',
    })
    expect(result.ok).toBe(false)
    const content = fakeSupabase.__store.content_items.find((c) => c.id === 'content-1')
    expect(content?.status).toBe('aprovacao_interna') // não mudou
  })
})
