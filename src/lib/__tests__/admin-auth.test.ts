import { describe, it, expect, afterEach } from 'vitest'
import { isSuperAdminEmail } from '@/lib/admin-auth'

describe('isSuperAdminEmail', () => {
  const original = process.env.ADMIN_EMAILS

  afterEach(() => {
    process.env.ADMIN_EMAILS = original
  })

  it('false sem ADMIN_EMAILS configurado', () => {
    delete process.env.ADMIN_EMAILS
    expect(isSuperAdminEmail('a@b.com')).toBe(false)
  })

  it('false pra e-mail null/undefined', () => {
    process.env.ADMIN_EMAILS = 'a@b.com'
    expect(isSuperAdminEmail(null)).toBe(false)
    expect(isSuperAdminEmail(undefined)).toBe(false)
  })

  it('reconhece um e-mail na lista, ignorando espaços e maiúsculas', () => {
    process.env.ADMIN_EMAILS = ' Admin@Empresa.com , outro@x.com '
    expect(isSuperAdminEmail('admin@empresa.com')).toBe(true)
    expect(isSuperAdminEmail('OUTRO@X.COM')).toBe(true)
  })

  it('rejeita um e-mail fora da lista', () => {
    process.env.ADMIN_EMAILS = 'admin@empresa.com'
    expect(isSuperAdminEmail('qualquer@outro.com')).toBe(false)
  })
})
