import 'server-only'

/**
 * Cliente para a Upload-Post API (https://upload-post.com) — usada para
 * conectar contas de redes sociais dos clientes e publicar/agendar posts.
 * Mantenha a API key apenas no servidor.
 */

const DEFAULT_API_URL = process.env.UPLOAD_POST_API_URL || 'https://api.upload-post.com'

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Apikey ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

export interface UploadPostProfile {
  username: string
  created_at: string
  social_accounts: Record<string, { username?: string; display_name?: string } | null>
}

interface UploadPostResult<T> {
  success: boolean
  data?: T
  error?: string
}

async function request<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<UploadPostResult<T>> {
  try {
    const res = await fetch(`${DEFAULT_API_URL}${path}`, {
      ...init,
      headers: { ...authHeaders(apiKey), ...(init.headers || {}) },
      signal: AbortSignal.timeout(15_000),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, error: json?.message || `HTTP ${res.status}` }
    }
    return { success: true, data: json }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

/** Garante que existe um "profile" (usuário) na Upload-Post para o cliente. */
export async function ensureProfile(apiKey: string, username: string) {
  const existing = await request<{ profile: UploadPostProfile }>(
    apiKey,
    `/api/uploadposts/users/${encodeURIComponent(username)}`,
  )
  if (existing.success) return existing

  return request<{ profile: UploadPostProfile }>(apiKey, '/api/uploadposts/users', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

/** Gera a URL (JWT) do widget de conexão de redes sociais para o cliente. */
export async function generateConnectUrl(
  apiKey: string,
  params: { username: string; redirect_url?: string; platforms?: string[] },
) {
  return request<{ access_url: string }>(apiKey, '/api/uploadposts/users/generate-jwt', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** Consulta o status das contas conectadas de um profile. */
export async function getProfileStatus(apiKey: string, username: string) {
  return request<{ profile: UploadPostProfile }>(
    apiKey,
    `/api/uploadposts/users/${encodeURIComponent(username)}`,
  )
}

export interface PublishParams {
  username: string
  platforms: string[]
  title?: string
  caption: string
  media_urls: string[]
  scheduled_date?: string // ISO — se ausente, publica imediatamente
}

/** Publica (ou agenda, se scheduled_date for informado) um post nas redes conectadas. */
export async function publishPost(apiKey: string, params: PublishParams) {
  const isVideo = params.media_urls.some((u) => /\.(mp4|mov|webm)$/i.test(u))
  const endpoint = isVideo ? '/api/upload_videos' : '/api/upload_photos'

  return request<{ job_id?: string; results?: Record<string, unknown> }>(apiKey, endpoint, {
    method: 'POST',
    body: JSON.stringify({
      user: params.username,
      platform: params.platforms,
      title: params.title || params.caption.slice(0, 80),
      caption: params.caption,
      photos: isVideo ? undefined : params.media_urls,
      video: isVideo ? params.media_urls[0] : undefined,
      scheduled_date: params.scheduled_date,
    }),
  })
}
