import { describe, it, expect } from 'vitest'
import { generateToken } from '@/lib/tokens'

describe('generateToken', () => {
  it('gera hex do tamanho esperado (24 bytes = 48 chars por padrão)', () => {
    const token = generateToken()
    expect(token).toMatch(/^[0-9a-f]{48}$/)
  })

  it('respeita o tamanho em bytes passado', () => {
    expect(generateToken(8)).toMatch(/^[0-9a-f]{16}$/)
  })

  it('gera tokens diferentes a cada chamada (não determinístico)', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(tokens.size).toBe(100)
  })
})
