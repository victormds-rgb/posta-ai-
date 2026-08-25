import 'server-only'
import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY não configurada. Gere com: openssl rand -hex 32',
    )
  }
  const key = Buffer.from(secret, 'hex')
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY precisa ter 32 bytes (64 caracteres hex).')
  }
  return key
}

/**
 * Cifra um segredo (token/senha de integração) antes de gravar no banco.
 * Formato do resultado: "iv.tag.dados", tudo em base64.
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((b) => b.toString('base64')).join('.')
}

/** Decifra um valor gerado por `encryptSecret`. */
export function decryptSecret(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Formato de segredo cifrado inválido.')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/** Versão mascarada de um segredo pra exibir na UI sem reexpor o valor real. */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return '••••'
  return `••••${plaintext.slice(-4)}`
}
