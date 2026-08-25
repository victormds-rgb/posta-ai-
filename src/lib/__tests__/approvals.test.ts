import { describe, it, expect } from 'vitest'
import { assertContentIsPublishable, getInternalApproverUserIds } from '@/lib/approvals'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'

describe('assertContentIsPublishable', () => {
  it('permite publicar quando não há nenhuma aprovação registrada', async () => {
    const supabase = createFakeSupabase({ internal_approvals: [], approval_links: [] })
    const result = await assertContentIsPublishable(supabase as never, 'content-1')
    expect(result.ok).toBe(true)
  })

  it('bloqueia quando há aprovação interna pendente', async () => {
    const supabase = createFakeSupabase({
      internal_approvals: [{ id: 'a1', content_id: 'content-1', status: 'pendente', created_at: '2026-01-01' }],
      approval_links: [],
    })
    const result = await assertContentIsPublishable(supabase as never, 'content-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/pendente/i)
  })

  it('bloqueia quando a aprovação interna mais recente pediu ajuste', async () => {
    const supabase = createFakeSupabase({
      internal_approvals: [{ id: 'a1', content_id: 'content-1', status: 'ajuste', created_at: '2026-01-01' }],
      approval_links: [],
    })
    const result = await assertContentIsPublishable(supabase as never, 'content-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/ajuste/i)
  })

  it('permite publicar quando a aprovação interna mais recente foi aprovada', async () => {
    const supabase = createFakeSupabase({
      internal_approvals: [{ id: 'a1', content_id: 'content-1', status: 'aprovado', created_at: '2026-01-01' }],
      approval_links: [],
    })
    const result = await assertContentIsPublishable(supabase as never, 'content-1')
    expect(result.ok).toBe(true)
  })

  it('bloqueia quando há link de aprovação externa pendente e ainda não expirado', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const supabase = createFakeSupabase({
      internal_approvals: [],
      approval_links: [{ id: 'l1', content_id: 'content-1', status: 'pendente', expires_at: future, created_at: '2026-01-01' }],
    })
    const result = await assertContentIsPublishable(supabase as never, 'content-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/cliente/i)
  })

  it('ignora link de aprovação externa pendente porém expirado', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const supabase = createFakeSupabase({
      internal_approvals: [],
      approval_links: [{ id: 'l1', content_id: 'content-1', status: 'pendente', expires_at: past, created_at: '2026-01-01' }],
    })
    const result = await assertContentIsPublishable(supabase as never, 'content-1')
    expect(result.ok).toBe(true)
  })

  it('não é afetado por aprovações de outro conteúdo', async () => {
    const supabase = createFakeSupabase({
      internal_approvals: [{ id: 'a1', content_id: 'content-OUTRO', status: 'pendente', created_at: '2026-01-01' }],
      approval_links: [],
    })
    const result = await assertContentIsPublishable(supabase as never, 'content-1')
    expect(result.ok).toBe(true)
  })
})

describe('getInternalApproverUserIds', () => {
  it('só inclui membros ativos com approveInternal efetivo', async () => {
    const supabase = createFakeSupabase({
      members: [
        { id: 'm1', user_id: 'admin-1', org_id: 'org1', role: 'admin', status: 'active', custom_permissions: null },
        { id: 'm2', user_id: 'designer-1', org_id: 'org1', role: 'designer', status: 'active', custom_permissions: null },
        {
          id: 'm3',
          user_id: 'designer-2',
          org_id: 'org1',
          role: 'designer',
          status: 'active',
          custom_permissions: { approveInternal: true },
        },
        { id: 'm4', user_id: 'gestor-inactive', org_id: 'org1', role: 'gestor', status: 'inactive', custom_permissions: null },
        { id: 'm5', user_id: 'admin-other-org', org_id: 'org2', role: 'admin', status: 'active', custom_permissions: null },
      ],
    })

    const approverIds = await getInternalApproverUserIds(supabase as never, 'org1')
    expect(approverIds.sort()).toEqual(['admin-1', 'designer-2'].sort())
  })

  it('exclui o próprio solicitante quando excludeUserId é passado', async () => {
    const supabase = createFakeSupabase({
      members: [
        { id: 'm1', user_id: 'admin-1', org_id: 'org1', role: 'admin', status: 'active', custom_permissions: null },
        { id: 'm2', user_id: 'admin-2', org_id: 'org1', role: 'admin', status: 'active', custom_permissions: null },
      ],
    })

    const approverIds = await getInternalApproverUserIds(supabase as never, 'org1', 'admin-1')
    expect(approverIds).toEqual(['admin-2'])
  })
})
