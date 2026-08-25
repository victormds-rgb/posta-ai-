# Posta AI

Plataforma de gestão de conteúdo para agências de social media: planejamento
em kanban, aprovação de conteúdo por link público e publicação nas redes
sociais via [Upload-Post](https://upload-post.com).

Este projeto é uma **implementação própria**, inspirada na análise do
sistema [postzap](https://github.com/gabrielkendy/postzap), reescrita do zero
com código, schema e decisões de arquitetura próprios — ver
[`ANALISE-POSTZAP.md`](./ANALISE-POSTZAP.md) para o relatório de análise e
[`ROADMAP.md`](./ROADMAP.md) para o que ainda falta em relação ao sistema de
referência.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) — veja `AGENTS.md`, há
  mudanças importantes em relação a versões anteriores (ex.: `middleware.ts`
  virou `proxy.ts`).
- **Supabase** — Postgres + Auth (e-mail/senha e Google OAuth) + Storage
  (bucket `media`) + Row Level Security multi-tenant.
- **Tailwind CSS v4** para estilo.
- **Upload-Post API** para conectar redes sociais dos clientes e
  publicar/agendar posts.

## Setup

### 1. Banco de dados (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra o **SQL Editor** e rode, **em ordem**, os arquivos de `sql/`:
   1. [`001_init.sql`](./sql/001_init.sql) — schema base (tabelas + RLS +
      triggers + bucket de storage `media`).
   2. [`002_granular_permissions.sql`](./sql/002_granular_permissions.sql) —
      coluna `members.custom_permissions` (permissões por membro).
   3. [`003_internal_approvals.sql`](./sql/003_internal_approvals.sql) —
      tabela `internal_approvals` (aprovação interna da equipe).
   4. [`004_notifications_insert_policy.sql`](./sql/004_notifications_insert_policy.sql) —
      ajusta a RLS de `notifications` pra permitir notificar outros membros.
3. (Opcional) Em **Authentication → Providers → Google**, configure o Client
   ID/Secret para permitir login com Google.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` — em Supabase → Project Settings → API.
- `ADMIN_EMAILS` — não é usado para autorização nesta versão (ver ROADMAP),
  mantido para compatibilidade futura.
- `CRON_SECRET` — protege `/api/cron/process-scheduled`; gere com
  `node -e "console.log(crypto.randomUUID())"`.
- `UPLOAD_POST_API_KEY` — fallback global; cada organização também pode
  configurar sua própria chave em **Configurações**.
- `NEXT_PUBLIC_APP_URL` — usada para montar links de aprovação e convite.

### 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`, crie uma conta — uma organização é criada
automaticamente para o primeiro usuário (via trigger `handle_new_user`).

### 4. Publicação em redes sociais

1. Vá em **Configurações** e cole a chave da API da Upload-Post (ou defina
   `UPLOAD_POST_API_KEY` no ambiente como fallback).
2. Em cada cliente, abra **Redes sociais** → **Conectar redes** — abre o
   widget da Upload-Post para autorizar Instagram/TikTok/Facebook/etc.
3. Em qualquer conteúdo do kanban, use **Publicar agora** (imediato) ou
   defina uma data em **Agendar publicação** — um cron
   (`vercel.json` → `/api/cron/process-scheduled`, a cada 15min) publica os
   agendados automaticamente.

## Fluxo principal

```
Kanban de conteúdo → (opcional) Solicitar aprovação interna → aprovar/pedir ajuste
   → Gerar link de aprovação → Cliente final aprova/pede ajuste via /aprovacao (sem login)
   → Publicar agora / Agendar → Upload-Post publica nas redes
```

Publicar/agendar é bloqueado enquanto houver uma aprovação (interna ou o
link do cliente) pendente ou com ajuste solicitado — ver
[`src/lib/approvals.ts`](./src/lib/approvals.ts).

## Estrutura

```
sql/                       migrations, em ordem (001, 002, 003, 004...)
src/lib/                   clientes Supabase, permissões, tokens, Upload-Post,
                            aprovações, notificações, rate limit, validação (zod)
src/app/(dashboard)/       área logada: clientes, kanban, calendário, equipe, configurações
src/app/aprovacao/         página pública de aprovação (sem login)
src/app/auth/invite/       aceite de convite de equipe
src/app/api/                rotas server-side (CRUD, aprovação, social, cron)
tests/helpers/              cliente Supabase fake (em memória) usado pelos testes
```

## Papéis e permissões

`admin`, `gestor`, `designer`, `cliente` têm um conjunto padrão de
permissões (`ROLE_PERMISSIONS` em `src/lib/permissions.ts`), cobrindo
dashboard, clientes, conteúdo, mídia, aprovação interna, publicação,
equipe, configurações e integrações. Um admin pode sobrescrever
permissões individualmente por membro em **Equipe** (`members.custom_permissions`)
— alterar `role`/permissões de outro membro exige ser admin de verdade,
não só ter `manageTeam` concedido por override (evita autopromoção).

## Aprovação interna

Além do link público para o cliente final, existe um fluxo de aprovação
interna da equipe: quem tem `manageContent` solicita revisão, quem tem
`approveInternal` aprova ou pede ajuste (com motivo). Histórico completo
por conteúdo em `internal_approvals`. Publicar/agendar é bloqueado
enquanto houver uma aprovação (interna ou externa) pendente ou com ajuste
em aberto.

## Notificações

Eventos de aprovação (solicitada/aprovada/ajuste), equipe (novo membro) e
permissões alteradas geram notificações in-app (sino no topo, com
contagem de não lidas). A lista atualiza por polling a cada 30s.

## Segurança

- Headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS)
  em `next.config.ts`.
- Rate limiting em memória (best-effort — ver nota em `src/lib/rate-limit.ts`
  sobre limitações em ambientes serverless) nas rotas públicas/sensíveis:
  aprovação por link, convite, upload de mídia, criação de convite.
- Validação de entrada com `zod` (`src/lib/validation.ts`) nas rotas mais
  expostas a input não confiável.
- Erros 500 nunca vazam mensagem interna do Postgres em produção
  (`src/lib/errors.ts`) — logam no servidor, respondem genérico ao cliente.
- Chave da Upload-Post nunca é reenviada ao navegador depois de salva (só
  um indicador booleano de "configurada").

## Testes

```bash
npm test
```

Suíte com Vitest: lógica pura (permissões, validação, tokens, rate limit,
gate de aprovação) e rotas de API mockando o cliente Supabase
(`tests/helpers/fake-supabase.ts`) — sem depender de um Supabase real.
Cobre isolamento multi-tenant, bloqueio de operações sem permissão (via
chamada direta à API, não só UI escondida) e o fluxo de aprovação pública
por token (válido/inválido/expirado).

## Deploy

Pensado para [Vercel](https://vercel.com): configure as variáveis de
ambiente do `.env.example` no projeto, conecte o repositório e o cron de
`vercel.json` é agendado automaticamente.
