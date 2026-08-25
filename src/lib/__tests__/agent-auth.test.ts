import { describe, it, expect, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { generateAgentToken, getAgentOrgId } from '@/lib/agent-auth'

describe('generateAgentToken', () => {
  it('gera um token com prefixo pai_ e hash consistente', () => {
    const { token, hash, prefix } = generateAgentToken()
    expect(token).toMatch(/^pai_[0-9a-f]{48}$/)
    expect(prefix).toBe(token.slice(0, 12))
    expect(hash).toHaveLength(64)
  })

  it('gera tokens diferentes a cada chamada', () => {
    const a = generateAgentToken()
    const b = generateAgentToken()
    expect(a.token).not.toBe(b.token)
  })
})

describe('getAgentOrgId', () => {
  let fakeSupabase: ReturnType<typeof createFakeSupabase>

  beforeEach(() => {
    fakeSupabase = createFakeSupabase({ org_agent_tokens: [] })
  })

  it('retorna null sem header Authorization', async () => {
    const orgId = await getAgentOrgId(new Request('http://x'), fakeSupabase as never)
    expect(orgId).toBeNull()
  })

  it('retorna null pra um token que não existe', async () => {
    const orgId = await getAgentOrgId(new Request('http://x', { headers: { authorization: 'Bearer pai_naoexiste' } }), fakeSupabase as never)
    expect(orgId).toBeNull()
  })

  it('resolve o org_id pra um token válido e atualiza last_used_at', async () => {
    const { token, hash } = generateAgentToken()
    fakeSupabase.__store.org_agent_tokens = [
      { id: 't1', org_id: 'org-1', name: 'Teste', token_hash: hash, token_prefix: token.slice(0, 12), created_at: '2026-01-01', last_used_at: null },
    ]
    const orgId = await getAgentOrgId(new Request('http://x', { headers: { authorization: `Bearer ${token}` } }), fakeSupabase as never)
    expect(orgId).toBe('org-1')
    expect(fakeSupabase.__store.org_agent_tokens[0].last_used_at).not.toBeNull()
  })
})
