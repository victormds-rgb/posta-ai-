import 'server-only'

/**
 * Cliente pro Meta Marketing API (Graph API), lendo métricas de uma conta
 * de anúncios. Usa um access token de longa duração gerado pela própria
 * organização no Meta Business Suite (Business Settings → System Users) —
 * BYO token, como Z-API/Telegram: não exige um app nosso revisado pela
 * Meta pra consultas básicas de insights com um token já emitido.
 */

const GRAPH_BASE = 'https://graph.facebook.com/v19.0'

interface MetaResult<T> {
  success: boolean
  data?: T
  error?: string
}

async function request<T>(path: string, accessToken: string): Promise<MetaResult<T>> {
  try {
    const url = new URL(`${GRAPH_BASE}${path}`)
    url.searchParams.set('access_token', accessToken)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: data?.error?.message || `HTTP ${res.status}` }
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

/** Confirma que o token é válido. */
export function metaValidateToken(accessToken: string) {
  return request<{ id: string; name?: string }>('/me', accessToken)
}

export interface MetaAdInsight {
  spend: string
  impressions: string
  clicks: string
  date_start: string
  date_stop: string
}

/** Insights agregados da conta de anúncios (últimos 30 dias por padrão). */
export function metaGetAdAccountInsights(accessToken: string, adAccountId: string, datePreset = 'last_30d') {
  const account = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  return request<{ data: MetaAdInsight[] }>(
    `/${account}/insights?fields=spend,impressions,clicks,date_start,date_stop&date_preset=${datePreset}`,
    accessToken,
  )
}
