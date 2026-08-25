import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next.js 16 renomeou "middleware" para "proxy" — mesma função, novo nome.
//
// Roteamento por subdomínio (app./cliente.dominio.com, Fase 4 do roadmap):
// decisão deliberada de NÃO implementar ainda — depende de um domínio de
// produção definitivo (DNS real, wildcard cert) que ainda não existe pra
// este projeto. O Portal do cliente (/portal) já entrega o mesmo resultado
// funcional por path, sem depender de infraestrutura de domínio. Quando o
// domínio final for decidido, o roteamento por subdomínio pode ser
// adicionado aqui lendo `request.headers.get('host')` e reescrevendo pra
// `/portal/...`, sem precisar tocar no restante da aplicação.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const { supabaseResponse, user } = await updateSession(request)

  const isPublicPath =
    pathname === '/' ||
    [
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/aprovacao',
      '/acervo',
      '/auth',
    ].some((p) => pathname.startsWith(p))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/clientes'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
