import 'server-only'
import { assertPublicUrl } from '@/lib/url-safety'

/**
 * Cliente para a REST API do WordPress do cliente final, autenticado via
 * "Application Password" — mecanismo nativo do próprio WordPress (Usuários
 * → Perfil → Senhas de Aplicativo), sem precisar de app revisado por
 * terceiro. Cada cliente conecta o site dele em `client_wordpress_config`.
 */

interface WpResult<T> {
  success: boolean
  data?: T
  error?: string
}

function authHeader(username: string, appPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`
}

async function request<T>(siteUrl: string, path: string, username: string, appPassword: string, init: RequestInit = {}): Promise<WpResult<T>> {
  // site_url é escolhido pela agência/cliente — sem essa checagem, esta
  // função vira uma forma de sondar a rede interna do servidor (SSRF).
  const urlCheck = await assertPublicUrl(siteUrl)
  if (!urlCheck.ok) return { success: false, error: urlCheck.reason }

  try {
    const base = siteUrl.replace(/\/+$/, '')
    const res = await fetch(`${base}/wp-json/wp/v2${path}`, {
      ...init,
      headers: {
        Authorization: authHeader(username, appPassword),
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: data?.message || `HTTP ${res.status}` }
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

/** Confirma que as credenciais funcionam, consultando o usuário autenticado. */
export function wpTestConnection(siteUrl: string, username: string, appPassword: string) {
  return request<{ id: number; name: string }>(siteUrl, '/users/me', username, appPassword)
}

/** Cria (ou publica) um post no WordPress do cliente, espelhando um conteúdo. */
export function wpCreatePost(
  siteUrl: string,
  username: string,
  appPassword: string,
  post: { title: string; content: string; status?: 'publish' | 'draft' },
) {
  return request<{ id: number; link: string }>(siteUrl, '/posts', username, appPassword, {
    method: 'POST',
    body: JSON.stringify({ title: post.title, content: post.content, status: post.status || 'publish' }),
  })
}
