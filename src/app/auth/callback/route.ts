import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/** Troca o código OAuth (Google) ou o link de confirmação por uma sessão. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/clientes'

  if (code) {
    const supabase = await createServerSupabase()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${redirect}`)
}
