import 'server-only'
import { getAppUrl } from '@/lib/get-app-url'

/**
 * OAuth + Drive API v3 — usado pra importar arquivos do Google Drive do
 * cliente pro Acervo digital. Exige um projeto Google Cloud próprio do
 * produto (GOOGLE_DRIVE_CLIENT_ID/SECRET), diferente do provider de login
 * (esse é gerenciado direto no Supabase Auth). 🟣 dependência externa —
 * ver .env.example.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

export function isGoogleDriveConfigured(): boolean {
  return !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET)
}

function redirectUri(): string {
  return `${getAppUrl()}/api/google-drive/callback`
}

/** URL de consentimento do Google pra iniciar a conexão. */
export function googleDriveAuthUrl(state: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_DRIVE_CLIENT_ID || '')
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  return url.toString()
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  error?: string
  error_description?: string
}

/** Troca o `code` do callback por tokens de acesso/refresh. */
export async function googleDriveExchangeCode(code: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok) return { success: false as const, error: data.error_description || data.error || `HTTP ${res.status}` }
  return { success: true as const, data }
}

/** Renova o access_token usando o refresh_token guardado. */
export async function googleDriveRefreshToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok) return { success: false as const, error: data.error_description || data.error || `HTTP ${res.status}` }
  return { success: true as const, data }
}

export interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  thumbnailLink?: string
}

/** Lista arquivos (opcionalmente dentro de uma pasta). */
export async function googleDriveListFiles(accessToken: string, folderId?: string) {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('fields', 'files(id,name,mimeType,thumbnailLink)')
  url.searchParams.set('pageSize', '50')
  if (folderId) url.searchParams.set('q', `'${folderId}' in parents and trashed = false`)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false as const, error: data?.error?.message || `HTTP ${res.status}` }
  return { success: true as const, data: data as { files: GoogleDriveFile[] } }
}

/** Baixa o conteúdo binário de um arquivo do Drive. */
export async function googleDriveDownloadFile(accessToken: string, fileId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) return { success: false as const, error: `HTTP ${res.status}` }
  const blob = await res.blob()
  return { success: true as const, blob }
}
