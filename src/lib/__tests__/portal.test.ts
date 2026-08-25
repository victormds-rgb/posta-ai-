import { describe, it, expect } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getPortalClientIds, assertPortalClientAccess } from '@/lib/portal'

describe('getPortalClientIds / assertPortalClientAccess', () => {
  const fakeSupabase = createFakeSupabase({
    client_members: [
      { id: 'cm-1', member_id: 'member-cliente-1', client_id: 'client-a', created_at: '2026-01-01' },
      { id: 'cm-2', member_id: 'member-cliente-1', client_id: 'client-b', created_at: '2026-01-01' },
      { id: 'cm-3', member_id: 'member-cliente-2', client_id: 'client-c', created_at: '2026-01-01' },
    ],
  })

  it('retorna só os client_ids vinculados a este membro', async () => {
    const ids = await getPortalClientIds(fakeSupabase as never, 'member-cliente-1')
    expect(ids.sort()).toEqual(['client-a', 'client-b'])
  })

  it('retorna vazio pra membro sem nenhum vínculo', async () => {
    const ids = await getPortalClientIds(fakeSupabase as never, 'member-sem-vinculo')
    expect(ids).toEqual([])
  })

  it('assertPortalClientAccess confirma acesso a cliente vinculado', async () => {
    expect(await assertPortalClientAccess(fakeSupabase as never, 'member-cliente-1', 'client-a')).toBe(true)
  })

  it('assertPortalClientAccess nega acesso a cliente de outro membro', async () => {
    expect(await assertPortalClientAccess(fakeSupabase as never, 'member-cliente-1', 'client-c')).toBe(false)
  })
})
