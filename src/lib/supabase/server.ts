import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase para Server Components / Route Handlers.
 * Usa os cookies da sessão atual — respeita RLS como o usuário logado.
 * Sem generic de Database — ver nota em lib/supabase/client.ts.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // chamado a partir de um Server Component — ok ignorar,
            // o proxy.ts já cuida de renovar a sessão.
          }
        },
      },
    },
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: any = null

/**
 * Cliente com a service_role key — ignora RLS.
 * Use apenas em rotas server-side que já validaram a autorização manualmente
 * (ex.: endpoints públicos de aprovação por token, webhooks, cron jobs).
 *
 * Tipado como `any` deliberadamente: sem `supabase gen types`, o generic
 * multi-nível do supabase-js resolve para `never` em alguns encadeamentos de
 * `ReturnType`. Os tipos de domínio (src/lib/types.ts) são aplicados no
 * retorno de cada query.
 */
export function createAdminSupabase() {
  if (!adminClient) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')
    adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return adminClient
}
