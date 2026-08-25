import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/content/kanban-board'
import { Share2, Palette, FolderOpen, Newspaper } from 'lucide-react'
import type { Client } from '@/lib/types'

export default async function ClientWorkflowPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ctx = await getCurrentContext()
  if (!ctx) notFound()

  const supabase = await createServerSupabase()
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .eq('slug', slug)
    .single<Client>()

  if (!client) notFound()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-lg text-white font-semibold"
            style={{ backgroundColor: client.brand_primary_color || '#6366F1' }}
          >
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted">Workflow de conteúdo</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/clientes/${client.slug}/redes`}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-soft"
          >
            <Share2 className="size-4" />
            Redes sociais
          </Link>
          <Link
            href={`/clientes/${client.slug}/brand`}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-soft"
          >
            <Palette className="size-4" />
            Brand book
          </Link>
          <Link
            href={`/clientes/${client.slug}/acervo`}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-soft"
          >
            <FolderOpen className="size-4" />
            Acervo digital
          </Link>
          <Link
            href={`/clientes/${client.slug}/wordpress`}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-soft"
          >
            <Newspaper className="size-4" />
            WordPress
          </Link>
        </div>
      </div>

      <KanbanBoard clientId={client.id} />
    </div>
  )
}
