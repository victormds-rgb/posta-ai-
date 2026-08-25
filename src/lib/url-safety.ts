import 'server-only'
import { lookup } from 'node:dns/promises'
import net from 'node:net'

/**
 * Bloqueia URLs que apontam pra rede interna do host (loopback, faixas
 * privadas, link-local, metadata da nuvem em 169.254.169.254) antes de um
 * `fetch()` — mitiga SSRF nos dois lugares do produto que fazem requisição
 * pra uma URL escolhida pelo usuário: webhook de saída e site WordPress do
 * cliente. Resolve o hostname de verdade (não só olha o texto da URL), pra
 * não deixar passar um domínio que resolve pra dentro.
 *
 * Não protege contra DNS rebinding (o hostname podia resolver pra um IP
 * público nesta checagem e pra um IP interno no fetch() seguido, alguns
 * milissegundos depois) — pra isso seria preciso fixar a conexão no IP já
 * resolvido, o que exige trocar o transporte do fetch. Fica documentado
 * como limitação conhecida, não coberta por esta função.
 */
export async function assertPublicUrl(rawUrl: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'URL inválida' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Só URLs http/https são permitidas' }
  }

  const hostname = url.hostname.toLowerCase()

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { ok: false, reason: 'URL aponta pra localhost' }
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { ok: false, reason: 'URL aponta pra um endereço de rede interno ou reservado' }
    }
    return { ok: true }
  }

  let addresses: string[]
  try {
    const results = await lookup(hostname, { all: true })
    addresses = results.map((r) => r.address)
  } catch {
    return { ok: false, reason: 'Não foi possível resolver o domínio' }
  }
  if (addresses.length === 0) {
    return { ok: false, reason: 'Domínio não resolveu pra nenhum endereço' }
  }
  if (addresses.some(isPrivateOrReservedIp)) {
    return { ok: false, reason: 'URL resolve pra um endereço de rede interno ou reservado' }
  }

  return { ok: true }
}

function isPrivateOrReservedIp(ip: string): boolean {
  const type = net.isIP(ip)
  if (type === 4) return isPrivateIPv4(ip)
  if (type === 6) return isPrivateIPv6(ip)
  return true // não reconhecido como IPv4/IPv6 válido — trata como suspeito
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true
  const [a, b] = parts
  if (a === 127) return true // 127.0.0.0/8 — loopback
  if (a === 10) return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 169 && b === 254) return true // 169.254.0.0/16 — link-local, inclui metadata da nuvem
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 — CGNAT
  if (a === 0) return true // 0.0.0.0/8
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1') return true // loopback
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.split(':').pop()
    if (mapped && net.isIPv4(mapped)) return isPrivateIPv4(mapped)
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // fc00::/7 — unique local
  if (lower.startsWith('fe80:')) return true // link-local
  return false
}
