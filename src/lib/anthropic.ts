import 'server-only'

/**
 * Cliente mínimo pra Messages API da Anthropic, via fetch direto (mesmo
 * padrão do resto do produto — sem SDK, ver Resend/Z-API/Telegram/
 * Upload-Post). 🟣 dependência externa: exige ANTHROPIC_API_KEY, custo por
 * uso — nunca chamado automaticamente, só quando o usuário pede geração.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'
const API_VERSION = '2023-06-01'

export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

interface AnthropicResult<T> {
  success: boolean
  data?: T
  error?: string
}

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<AnthropicResult<string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { success: false, error: 'ANTHROPIC_API_KEY não configurada neste ambiente.' }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: json?.error?.message || `HTTP ${res.status}` }

    const text = json?.content?.[0]?.text
    if (typeof text !== 'string') return { success: false, error: 'Resposta inesperada da API.' }
    return { success: true, data: text }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

/** Extrai o primeiro bloco JSON de um texto (a IA às vezes envolve com texto/markdown). */
function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
}

export interface GenerateDraftParams {
  clientName: string
  brand?: { primaryColor?: string | null; fonts?: string | null; guidelines?: string | null }
  brief: string
  referenceSummaries?: string[]
}

export interface GeneratedDraft {
  title: string
  caption: string
  carousel_slides: { heading: string; body: string }[]
  suggested_channels: string[]
}

/** Gera um rascunho de conteúdo (título, legenda, slides de carrossel) a partir de um briefing. */
export async function generateContentDraft(params: GenerateDraftParams): Promise<AnthropicResult<GeneratedDraft>> {
  const system = `Você é um estrategista de conteúdo de uma agência de social media. Gere um rascunho de post
a partir do briefing do usuário. Responda APENAS com um JSON válido, sem texto ao redor, no formato:
{"title": "...", "caption": "...", "carousel_slides": [{"heading": "...", "body": "..."}], "suggested_channels": ["instagram"]}
Use no máximo 6 slides. Canais possíveis: instagram, tiktok, facebook, linkedin, youtube, twitter.`

  const context = [
    `Cliente: ${params.clientName}`,
    params.brand?.guidelines ? `Diretrizes de marca: ${params.brand.guidelines}` : null,
    params.brand?.fonts ? `Fontes: ${params.brand.fonts}` : null,
    params.referenceSummaries?.length ? `Referências:\n${params.referenceSummaries.join('\n---\n')}` : null,
    `Briefing: ${params.brief}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const result = await callClaude(system, context)
  if (!result.success) return { success: false, error: result.error }

  const parsed = extractJson<GeneratedDraft>(result.data!)
  if (!parsed) return { success: false, error: 'Não foi possível interpretar a resposta da IA.' }
  return { success: true, data: parsed }
}

export interface AnalyzeSourceResult {
  summary: string
  angle_suggestions: string[]
  score: number
}

/** Analisa um material de referência colado manualmente pelo usuário (não raspado automaticamente). */
export async function analyzeContentSource(text: string): Promise<AnthropicResult<AnalyzeSourceResult>> {
  const system = `Você analisa material de referência de marketing colado por um usuário. Responda APENAS com
um JSON válido no formato: {"summary": "...", "angle_suggestions": ["...", "..."], "score": 7}
"score" é de 1 a 10, quão bom é esse material como inspiração pra um novo post.`

  const result = await callClaude(system, text.slice(0, 8000), 800)
  if (!result.success) return { success: false, error: result.error }

  const parsed = extractJson<AnalyzeSourceResult>(result.data!)
  if (!parsed) return { success: false, error: 'Não foi possível interpretar a resposta da IA.' }
  return { success: true, data: parsed }
}
