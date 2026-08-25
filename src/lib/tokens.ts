import { randomBytes } from 'crypto'

/** Gera um token opaco e seguro (hex) para links públicos (convite/aprovação). */
export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString('hex')
}
