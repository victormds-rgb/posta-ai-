'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente Supabase para uso em componentes de cliente ('use client').
 * Sem generic de Database: os tipos de domínio (src/lib/types.ts) são
 * aplicados manualmente no retorno das queries — evita depender de
 * `supabase gen types` para ter build funcionando.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
