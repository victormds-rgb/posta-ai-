import type { NextConfig } from 'next'

// Origens externas realmente usadas pelo app hoje:
// - Supabase: auth/rest/storage (https) + realtime (wss)
// - Upload-Post: só server-side (lib/upload-post.ts) — o widget de conexão
//   abre em nova aba via window.open, não em iframe/fetch desta página, então
//   não precisa entrar no CSP.
// Ajuste esta lista conforme novas integrações forem entrando (ver ROADMAP.md).
const SUPABASE_ORIGINS = 'https://*.supabase.co https://*.supabase.in'
const SUPABASE_WS_ORIGINS = 'wss://*.supabase.co wss://*.supabase.in'

const isProd = process.env.NODE_ENV === 'production'

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' só em dev: o HMR do Next precisa; build de produção não usa eval.
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGINS}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGINS} ${SUPABASE_WS_ORIGINS}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: csp },
  // Ignorado pelo navegador em HTTP puro (dev) — só tem efeito em produção via HTTPS.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
