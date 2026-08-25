import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/utils'

describe('slugify', () => {
  it('remove acentos e coloca em minúsculas', () => {
    expect(slugify('Padaria do Zé')).toBe('padaria-do-ze')
  })

  it('troca caracteres não alfanuméricos por hífen', () => {
    expect(slugify('Café & Cia — Filial 2!')).toBe('cafe-cia-filial-2')
  })

  it('remove hífens nas pontas', () => {
    expect(slugify('  --Olá Mundo--  ')).toBe('ola-mundo')
  })

  it('lida com string vazia', () => {
    expect(slugify('')).toBe('')
  })
})
