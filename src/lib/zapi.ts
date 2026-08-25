import 'server-only'

/**
 * Cliente Z-API (WhatsApp não-oficial) — cada organização traz sua própria
 * instância (instance_id + token), guardados cifrados em `org_whatsapp_config`.
 * Docs: https://developer.z-api.io
 */

const ZAPI_BASE = 'https://api.z-api.io/instances'
const TIMEOUT_MS = 10_000

function headers(token: string): HeadersInit {
  return { 'Client-Token': token, 'Content-Type': 'application/json' }
}

interface ZapiResult<T> {
  success: boolean
  data?: T
  error?: string
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<ZapiResult<T>> {
  try {
    const res = await fetch(`${ZAPI_BASE}${path}`, {
      ...init,
      headers: { ...headers(token), ...(init.headers || {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: data?.message || data?.error || `HTTP ${res.status}` }
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

export interface ZapiQrCode {
  value?: string // base64 PNG
  connected?: boolean
}

export interface ZapiStatus {
  connected: boolean
  smartphoneConnected?: boolean
  phone?: string
  error?: string
}

/** GET QR code pra parear o WhatsApp com a instância. */
export function zapiGetQrCode(instanceId: string, token: string) {
  return request<ZapiQrCode>(`/${instanceId}/token/${token}/qr-code/image`, token)
}

/** GET status de conexão da instância. */
export function zapiGetStatus(instanceId: string, token: string) {
  return request<ZapiStatus>(`/${instanceId}/token/${token}/status`, token)
}

/** POST desconecta a instância. */
export function zapiDisconnect(instanceId: string, token: string) {
  return request<{ value?: boolean }>(`/${instanceId}/token/${token}/disconnect`, token, { method: 'POST' })
}

/** POST envia mensagem de texto. */
export function zapiSendText(instanceId: string, token: string, phone: string, message: string) {
  return request<{ zaapId?: string; messageId?: string; id?: string }>(
    `/${instanceId}/token/${token}/send-text`,
    token,
    { method: 'POST', body: JSON.stringify({ phone, message }) },
  )
}
