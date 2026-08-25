import { describe, it, expect } from 'vitest'
import {
  approvalDecisionSchema,
  inviteAcceptSchema,
  inviteCreateSchema,
  clientCreateSchema,
  contentCreateSchema,
} from '@/lib/validation'

describe('approvalDecisionSchema', () => {
  it('aceita uma decisão válida', () => {
    const result = approvalDecisionSchema.safeParse({ action: 'aprovado' })
    expect(result.success).toBe(true)
  })

  it('rejeita action fora do enum', () => {
    const result = approvalDecisionSchema.safeParse({ action: 'rejeitado' })
    expect(result.success).toBe(false)
  })

  it('rejeita payload sem action', () => {
    const result = approvalDecisionSchema.safeParse({ comment: 'oi' })
    expect(result.success).toBe(false)
  })

  it('rejeita quando o payload não é um objeto (ex.: null vindo de JSON inválido)', () => {
    const result = approvalDecisionSchema.safeParse(null)
    expect(result.success).toBe(false)
  })
})

describe('inviteCreateSchema', () => {
  it('normaliza e-mail pra minúsculas e usa "designer" como padrão de role', () => {
    const result = inviteCreateSchema.parse({ email: 'Alguem@Example.com' })
    expect(result.email).toBe('alguem@example.com')
    expect(result.role).toBe('designer')
  })

  it('rejeita e-mail inválido', () => {
    expect(inviteCreateSchema.safeParse({ email: 'não-é-email' }).success).toBe(false)
  })

  it('rejeita role fora do enum permitido', () => {
    expect(inviteCreateSchema.safeParse({ email: 'a@b.com', role: 'superadmin' }).success).toBe(false)
  })
})

describe('inviteAcceptSchema', () => {
  it('exige um token não-vazio', () => {
    expect(inviteAcceptSchema.safeParse({ token: '' }).success).toBe(false)
    expect(inviteAcceptSchema.safeParse({}).success).toBe(false)
    expect(inviteAcceptSchema.safeParse({ token: 'abc123' }).success).toBe(true)
  })
})

describe('clientCreateSchema', () => {
  it('exige nome não-vazio', () => {
    expect(clientCreateSchema.safeParse({ name: '' }).success).toBe(false)
    expect(clientCreateSchema.safeParse({ name: 'Padaria do Zé' }).success).toBe(true)
  })
})

describe('contentCreateSchema', () => {
  it('exige client_id como uuid válido', () => {
    expect(contentCreateSchema.safeParse({ client_id: 'not-a-uuid' }).success).toBe(false)
    expect(contentCreateSchema.safeParse({ client_id: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(true)
  })

  it('aplica defaults de content_type, media_urls e channels', () => {
    const result = contentCreateSchema.parse({ client_id: '123e4567-e89b-12d3-a456-426614174000' })
    expect(result.content_type).toBe('post')
    expect(result.media_urls).toEqual([])
    expect(result.channels).toEqual([])
  })

  it('rejeita media_urls que não são URLs', () => {
    const result = contentCreateSchema.safeParse({
      client_id: '123e4567-e89b-12d3-a456-426614174000',
      media_urls: ['not-a-url'],
    })
    expect(result.success).toBe(false)
  })
})
