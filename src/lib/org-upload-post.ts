import 'server-only'
import type { Organization } from '@/lib/types'

/** Chave da Upload-Post: primeiro a da organização, senão o fallback global do .env. */
export function getOrgUploadPostKey(org: Organization): string | null {
  return org.upload_post_api_key || process.env.UPLOAD_POST_API_KEY || null
}

/** Username único e estável para o "profile" do cliente na Upload-Post. */
export function buildUploadPostUsername(orgSlug: string, clientSlug: string): string {
  return `${orgSlug}-${clientSlug}`.slice(0, 64)
}
