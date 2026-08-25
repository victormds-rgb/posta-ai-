import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import type { AiGeneration } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Lista os rascunhos gerados por IA pra este cliente (aceitos ou não). */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id: clientId } = await params
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('ai_generations')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return serverError(error, 'ia.rascunhos')
  return NextResponse.json({ generations: (data ?? []) as AiGeneration[] })
}
