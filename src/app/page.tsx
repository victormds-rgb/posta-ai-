import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CalendarCheck, MessageSquareText, Share2 } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <span className="text-lg font-semibold">Posta AI</span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted hover:text-foreground">
            Entrar
          </Link>
          <Link href="/signup">
            <Button size="sm">Criar conta grátis</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto w-full px-6 py-16 grid gap-12 md:grid-cols-2 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Planeje, aprove e publique conteúdo para seus clientes num só lugar.
            </h1>
            <p className="mt-5 text-lg text-muted">
              Workflow de conteúdo, aprovação por link público e publicação direta nas redes
              sociais — feito para agências e times de social media.
            </p>
            <div className="mt-8 flex gap-3">
              <Link href="/signup">
                <Button size="lg">Começar agora</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="secondary">
                  Já tenho conta
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <Feature
              icon={<CalendarCheck className="size-5" />}
              title="Kanban de conteúdo"
              description="Da ideia à publicação: organize cada cliente com um quadro de status próprio."
            />
            <Feature
              icon={<MessageSquareText className="size-5" />}
              title="Aprovação por link"
              description="Envie um link público de aprovação — o cliente aprova ou pede ajuste sem precisar de login."
            />
            <Feature
              icon={<Share2 className="size-5" />}
              title="Publicação nas redes"
              description="Conecte Instagram, TikTok, Facebook e mais — publique ou agende direto da plataforma."
            />
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-sm text-muted">
        © {new Date().getFullYear()} Posta AI
      </footer>
    </div>
  )
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
    </div>
  )
}
