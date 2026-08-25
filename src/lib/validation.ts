import 'server-only'
import { NextResponse } from 'next/server'
import { z, type ZodType } from 'zod'

/** Faz `request.json()` e valida com o schema. Retorna { data } ou { error } já pronto pra devolver. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: NextResponse }> {
  const raw = await request.json().catch(() => null)
  const result = schema.safeParse(raw)
  if (!result.success) {
    const firstIssue = result.error.issues[0]
    return {
      error: NextResponse.json(
        { error: firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Payload inválido' },
        { status: 400 },
      ),
    }
  }
  return { data: result.data }
}

// ---------------------------------------------------------------------------
// Schemas reutilizados pelas rotas mais expostas a input não confiável
// (endpoints públicos e criação de convites/conteúdo).
// ---------------------------------------------------------------------------

export const approvalDecisionSchema = z.object({
  action: z.enum(['aprovado', 'ajuste']),
  reviewer_name: z.string().trim().max(255).optional(),
  comment: z.string().trim().max(2000).optional(),
})

export const inviteAcceptSchema = z.object({
  token: z.string().trim().min(1).max(64),
})

export const inviteCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(['admin', 'gestor', 'designer', 'cliente']).default('designer'),
})

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255),
  contact: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(5000).optional(),
})

export const whatsappConnectSchema = z.object({
  instance_id: z.string().trim().min(1).max(100),
  token: z.string().trim().min(1).max(200),
})

export const whatsappSendSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  message: z.string().trim().min(1).max(4000),
  reference_id: z.string().uuid().optional(),
  reference_type: z.string().max(50).optional(),
})

export const telegramConnectSchema = z.object({
  bot_token: z.string().trim().min(1).max(200),
  approval_chat_id: z.string().trim().max(100).optional(),
})

export const checkoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'agency']),
  interval: z.enum(['month', 'year']),
})

export const contentCreateSchema = z.object({
  client_id: z.string().uuid('client_id inválido'),
  title: z.string().trim().max(500).optional(),
  content_type: z.enum(['post', 'carrossel', 'reels', 'story', 'video']).default('post'),
  description: z.string().trim().max(5000).optional(),
  caption: z.string().trim().max(5000).optional(),
  media_urls: z.array(z.string().url()).max(20).default([]),
  cover_url: z.string().url().optional().nullable(),
  channels: z.array(z.string()).max(10).default([]),
  status: z.enum(['ideia', 'producao', 'aprovacao_interna', 'aprovacao_cliente', 'agendado', 'publicado']).optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
})
