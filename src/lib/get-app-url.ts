/** URL pública da aplicação, usada para montar links de aprovação/convite. */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}
