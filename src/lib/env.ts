/**
 * Validação de variáveis de ambiente obrigatórias no boot do servidor —
 * falha cedo (erro claro no log de deploy) em vez de quebrar de forma
 * confusa na primeira request que precisar de uma env var ausente.
 * Chamado por `instrumentation.ts` (roda uma vez, no início do processo).
 *
 * Só valida o que é obrigatório pra o produto sequer subir (Supabase, cron,
 * cifra de credenciais). Integrações opcionais (Stripe, Resend, Anthropic,
 * Google Drive, Meta Ads…) são validadas na hora do uso, com uma mensagem
 * de erro específica — não travam o boot, porque são "🟣 dependência
 * externa" opcional, não pré-requisito do produto.
 */

const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}. Veja .env.example e configure antes de subir o servidor.`,
    )
  }

  if (process.env.CREDENTIALS_ENCRYPTION_KEY) {
    const key = process.env.CREDENTIALS_ENCRYPTION_KEY
    if (!/^[0-9a-f]{64}$/i.test(key)) {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY precisa ter 64 caracteres hex (32 bytes) — gere com: openssl rand -hex 32')
    }
  }
}
