import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analyzeContentSource, generateContentDraft, isAnthropicConfigured } from '@/lib/anthropic'

describe('isAnthropicConfigured', () => {
  const original = process.env.ANTHROPIC_API_KEY

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = original
  })

  it('false sem a env var', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(isAnthropicConfigured()).toBe(false)
  })

  it('true com a env var setada', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-x'
    expect(isAnthropicConfigured()).toBe(true)
  })
})

describe('generateContentDraft', () => {
  const fetchMock = vi.fn()
  const originalFetch = global.fetch
  const originalKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.ANTHROPIC_API_KEY = originalKey
  })

  it('falha sem ANTHROPIC_API_KEY configurada', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const result = await generateContentDraft({ clientName: 'X', brief: 'teste' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/ANTHROPIC_API_KEY/)
  })

  it('interpreta o JSON retornado pela IA', async () => {
    const draft = {
      title: 'Promoção de verão',
      caption: 'Aproveite!',
      carousel_slides: [{ heading: 'Slide 1', body: 'Corpo' }],
      suggested_channels: ['instagram'],
    }
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: JSON.stringify(draft) }] }),
    })
    const result = await generateContentDraft({ clientName: 'Padaria', brief: 'post de verão' })
    expect(result.success).toBe(true)
    expect(result.data?.title).toBe('Promoção de verão')
  })

  it('retorna erro quando a IA responde algo não-JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ text: 'não é json' }] }) })
    const result = await generateContentDraft({ clientName: 'X', brief: 'teste' })
    expect(result.success).toBe(false)
  })

  it('propaga erro HTTP da API', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'chave inválida' } }) })
    const result = await generateContentDraft({ clientName: 'X', brief: 'teste' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('chave inválida')
  })
})

describe('analyzeContentSource', () => {
  const fetchMock = vi.fn()
  const originalFetch = global.fetch
  const originalKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.ANTHROPIC_API_KEY = originalKey
  })

  it('interpreta a análise retornada pela IA', async () => {
    const analysis = { summary: 'Bom material', angle_suggestions: ['ângulo 1'], score: 8 }
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ text: JSON.stringify(analysis) }] }) })
    const result = await analyzeContentSource('texto de referência')
    expect(result.success).toBe(true)
    expect(result.data?.score).toBe(8)
  })
})
