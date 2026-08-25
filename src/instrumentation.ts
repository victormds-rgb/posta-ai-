/**
 * Roda uma vez quando uma nova instância do servidor Next.js inicia —
 * usado aqui só pra falhar cedo se faltar uma env var obrigatória (ver
 * lib/env.ts), em vez de o produto subir "funcionando" e quebrar na
 * primeira request real. Guardado por NEXT_RUNTIME porque este hook
 * também dispara no runtime Edge, onde não faz sentido rodar isso.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env')
    validateEnv()
  }
}
