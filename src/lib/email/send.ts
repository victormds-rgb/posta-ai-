import 'server-only'

const RESEND_API_URL = 'https://api.resend.com/emails'

export interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

/**
 * Envia e-mail transacional via Resend (REST direto, sem SDK — mesmo padrão
 * usado pra Upload-Post/Z-API). Sem RESEND_API_KEY configurada, retorna
 * `success: false` sem lançar — quem chama decide se isso é bloqueante.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY não configurada' }

  const from = process.env.EMAIL_FROM || 'Posta AI <onboarding@resend.dev>'

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: data?.message || `HTTP ${res.status}` }
    return { success: true, id: data.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}
