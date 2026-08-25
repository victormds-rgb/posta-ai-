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
2. Abra o **SQL Editor** e rode o conteúdo de [`sql/001_init.sql`](./sql/001_init.sql).
   Isso cria as tabelas, políticas de RLS, triggers e o bucket de storage `media`.
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
Cliente (agência) → Kanban de conteúdo → Gerar link de aprovação
   → Cliente final aprova/pede ajuste via /aprovacao (sem login)
   → Publicar agora / Agendar → Upload-Post publica nas redes
```

## Estrutura

```
sql/001_init.sql          schema completo (tabelas + RLS + triggers + storage)
src/lib/                  clientes Supabase, permissões, tokens, Upload-Post
src/app/(dashboard)/      área logada: clientes, kanban, calendário, equipe, configurações
src/app/aprovacao/        página pública de aprovação (sem login)
src/app/auth/invite/      aceite de convite de equipe
src/app/api/              rotas server-side (CRUD, aprovação, social, cron)
```

## Papéis e permissões

`admin`, `gestor`, `designer`, `cliente` — capacidades fixas por papel em
`src/lib/permissions.ts`. Uma matriz de permissões por membro (como o
sistema de referência tem) fica para uma fase futura — ver ROADMAP.

## Deploy

Pensado para [Vercel](https://vercel.com): configure as variáveis de
ambiente do `.env.example` no projeto, conecte o repositório e o cron de
`vercel.json` é agendado automaticamente.
