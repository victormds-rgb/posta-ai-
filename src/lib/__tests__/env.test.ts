import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateEnv } from '@/lib/env'

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']

describe('validateEnv', () => {
  let backup: Record<string, string | undefined>

  beforeEach(() => {
    backup = Object.fromEntries(REQUIRED.map((k) => [k, process.env[k]]))
    for (const k of REQUIRED) process.env[k] = `valor-${k}`
  })

  afterEach(() => {
    for (const k of REQUIRED) {
      if (backup[k] === undefined) delete process.env[k]
      else process.env[k] = backup[k]
    }
  })

  it('não lança quando tudo está presente', () => {
    expect(() => validateEnv()).not.toThrow()
  })

  it('lança listando a(s) variável(is) ausente(s)', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('valida o formato de CREDENTIALS_ENCRYPTION_KEY quando presente', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'chave-curta-demais'
    expect(() => validateEnv()).toThrow(/CREDENTIALS_ENCRYPTION_KEY/)
    delete process.env.CREDENTIALS_ENCRYPTION_KEY
  })

  it('aceita CREDENTIALS_ENCRYPTION_KEY com 64 chars hex', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'a'.repeat(64)
    expect(() => validateEnv()).not.toThrow()
    delete process.env.CREDENTIALS_ENCRYPTION_KEY
  })
})
