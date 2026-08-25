import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'

const ORIGINAL_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
})

afterEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = ORIGINAL_KEY
})

describe('encryptSecret / decryptSecret', () => {
  it('decifra exatamente o que foi cifrado', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/crypto')
    const plaintext = 'meu-token-super-secreto-123'
    const encrypted = decryptSecret(encryptSecret(plaintext))
    expect(encrypted).toBe(plaintext)
  })

  it('duas cifragens do mesmo texto produzem resultados diferentes (IV aleatório)', async () => {
    const { encryptSecret } = await import('@/lib/crypto')
    const a = encryptSecret('mesmo-valor')
    const b = encryptSecret('mesmo-valor')
    expect(a).not.toBe(b)
  })

  it('falha ao decifrar com a chave errada', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/crypto')
    const encrypted = encryptSecret('valor-secreto')
    process.env.CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
    expect(() => decryptSecret(encrypted)).toThrow()
  })

  it('falha sem CREDENTIALS_ENCRYPTION_KEY configurada', async () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY
    const { encryptSecret } = await import('@/lib/crypto')
    expect(() => encryptSecret('x')).toThrow(/CREDENTIALS_ENCRYPTION_KEY/)
  })

  it('falha com chave de tamanho errado', async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'chave-curta-demais'
    const { encryptSecret } = await import('@/lib/crypto')
    expect(() => encryptSecret('x')).toThrow(/32 bytes/)
  })
})

describe('maskSecret', () => {
  it('mantém só os últimos 4 caracteres visíveis', async () => {
    const { maskSecret } = await import('@/lib/crypto')
    expect(maskSecret('abcdefgh1234')).toBe('••••1234')
  })

  it('mascara totalmente valores curtos', async () => {
    const { maskSecret } = await import('@/lib/crypto')
    expect(maskSecret('ab')).toBe('••••')
  })
})
