process.env.CREDENTIALS_ENCRYPTION_KEY ||= 'c'.repeat(64)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { encryptSecret } from '@/lib/crypto'
import { dispatchWebhookEvent, retryFailedWebhookEvents, signWebhookPayload } from '@/lib/webhook-dispatch'

describe('signWebhookPayload', () => {
  it('gera assinaturas diferentes pra secrets diferentes', () => {
    const a = signWebhookPayload('secret-a', '{"x":1}')
    const b = signWebhookPayload('secret-b', '{"x":1}')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('é determinístico pro mesmo secret e payload', () => {
    const a = signWebhookPayload('secret', 'corpo')
    const b = signWebhookPayload('secret', 'corpo')
    expect(a).toBe(b)
  })
})

describe('dispatchWebhookEvent', () => {
  const fetchMock = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('não faz nada se nenhum webhook está inscrito no evento', async () => {
    const fakeSupabase = createFakeSupabase({ webhook_configs: [], webhook_events: [] })
    await dispatchWebhookEvent(fakeSupabase as never, { orgId: 'org-1', eventType: 'content.created', payload: {} })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('entrega com sucesso e marca o evento como success', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const fakeSupabase = createFakeSupabase({
      webhook_configs: [{ id: 'wh1', org_id: 'org-1', url: 'https://x.com/hook', secret: encryptSecret('s3cr3t'), events: ['content.created'], active: true, created_at: '2026-01-01' }],
      webhook_events: [],
    })
    await dispatchWebhookEvent(fakeSupabase as never, { orgId: 'org-1', eventType: 'content.created', payload: { foo: 'bar' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fakeSupabase.__store.webhook_events).toHaveLength(1)
    expect(fakeSupabase.__store.webhook_events[0].status).toBe('success')
  })

  it('marca como failed quando a entrega falha, sem lançar exceção', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'))
    const fakeSupabase = createFakeSupabase({
      webhook_configs: [{ id: 'wh1', org_id: 'org-1', url: 'https://x.com/hook', secret: encryptSecret('s3cr3t'), events: ['content.published'], active: true, created_at: '2026-01-01' }],
      webhook_events: [],
    })
    await dispatchWebhookEvent(fakeSupabase as never, { orgId: 'org-1', eventType: 'content.published', payload: {} })
    expect(fakeSupabase.__store.webhook_events[0].status).toBe('failed')
    expect(fakeSupabase.__store.webhook_events[0].last_error).toBe('timeout')
  })

  it('não entrega pra webhooks pausados ou de outros eventos', async () => {
    const fakeSupabase = createFakeSupabase({
      webhook_configs: [
        { id: 'wh1', org_id: 'org-1', url: 'https://x.com/a', secret: encryptSecret('s'), events: ['content.created'], active: false, created_at: '2026-01-01' },
        { id: 'wh2', org_id: 'org-1', url: 'https://x.com/b', secret: encryptSecret('s'), events: ['content.published'], active: true, created_at: '2026-01-01' },
      ],
      webhook_events: [],
    })
    await dispatchWebhookEvent(fakeSupabase as never, { orgId: 'org-1', eventType: 'content.created', payload: {} })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('retryFailedWebhookEvents', () => {
  const fetchMock = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('reprocessa um evento falho cujo horário já passou e marca sucesso', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const past = new Date(Date.now() - 60_000).toISOString()
    const fakeSupabase = createFakeSupabase({
      webhook_configs: [{ id: 'wh1', org_id: 'org-1', url: 'https://x.com/hook', secret: encryptSecret('s'), events: ['content.created'], active: true, created_at: '2026-01-01' }],
      webhook_events: [{ id: 'ev1', org_id: 'org-1', webhook_config_id: 'wh1', event_type: 'content.created', payload: {}, status: 'failed', attempts: 1, next_attempt_at: past, created_at: '2026-01-01' }],
    })
    const result = await retryFailedWebhookEvents(fakeSupabase as never)
    expect(result.retried).toBe(1)
    expect(result.succeeded).toBe(1)
    expect(fakeSupabase.__store.webhook_events[0].status).toBe('success')
  })

  it('ignora eventos cujo next_attempt_at ainda não chegou', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const fakeSupabase = createFakeSupabase({
      webhook_configs: [{ id: 'wh1', org_id: 'org-1', url: 'https://x.com/hook', secret: encryptSecret('s'), events: ['content.created'], active: true, created_at: '2026-01-01' }],
      webhook_events: [{ id: 'ev1', org_id: 'org-1', webhook_config_id: 'wh1', event_type: 'content.created', payload: {}, status: 'failed', attempts: 1, next_attempt_at: future, created_at: '2026-01-01' }],
    })
    const result = await retryFailedWebhookEvents(fakeSupabase as never)
    expect(result.retried).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
