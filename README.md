# Posta AI

Plataforma completa de gestão de conteúdo para agências de social media:
planejamento em kanban, campanhas e tarefas, aprovação interna e por
cliente, publicação multi-rede, portal do cliente, acervo digital e brand
book, billing, comunicação (e-mail/WhatsApp/Telegram), analytics,
integrações (WordPress/Meta Ads/Google Drive), geração de conteúdo por IA,
webhooks/API de agente e painel administrativo.

Este projeto é uma **implementação própria**, inspirada na análise do
sistema [postzap](https://github.com/gabrielkendy/postzap), reescrita do
zero com código, schema e decisões de arquitetura próprios — ver
[`ANALISE-POSTZAP.md`](./ANALISE-POSTZAP.md) para o relatório de análise e
[`ROADMAP.md`](./ROADMAP.md) para o mapa completo de capacidades, decisões
de arquitetura registradas por fase e o que ainda depende de credenciais
externas. Para operação em produção (backup, incidentes, checklist de
deploy), ver [`RUNBOOK.md`](./RUNBOOK.md).

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) — veja `AGENTS.md`, há
  mudanças importantes em relação a versões anteriores (ex.: `middleware.ts`
  virou `proxy.ts`).
- **Supabase** — Postgres + Auth (e-mail/senha e Google OAuth) + Storage
  (bucket `media`) + Row Level Security multi-tenant.
- **Tailwind CSS v4** para estilo.
- **Stripe** para assinaturas/billing.
- **Integrações via fetch direto** (sem SDK, exceto Stripe): Upload-Post,
  Resend, Z-API (WhatsApp), Telegram, WordPress, Meta Ads, Google Drive
  (OAuth), Anthropic (Claude).

## Setup

### 1. Banco de dados (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra o **SQL Editor** e rode, **em ordem**, todos os arquivos de `sql/`
   (`001_init.sql` até o número mais alto disponível) — cada um é uma
   migration incremental, nunca reescreve o schema anterior. A partir de
   `013_schema_migrations.sql`, a tabela `schema_migrations` registra quais
   já rodaram nesse projeto — confira com
   `select version from schema_migrations order by version;` antes de
   aplicar mais alguma, e termine toda migration nova com
   `insert into schema_migrations (version) values ('0NN_nome') on conflict (version) do nothing;`.
3. (Opcional) Em **Authentication → Providers → Google**, configure o
   Client ID/Secret para permitir login com Google.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha pelo menos o bloco
**obrigatório** (Supabase, `ADMIN_EMAILS`, `CRON_SECRET`). Tudo o mais é
opcional e cada seção do `.env.example` explica quando vale a pena
configurar — a maioria das integrações (WhatsApp, Telegram, Meta Ads,
WordPress) é conectada **pela própria organização dentro do produto**, não
por variável de ambiente.

```bash
cp .env.example .env.local
```

O servidor valida as env vars obrigatórias no boot (`src/instrumentation.ts`
→ `src/lib/env.ts`) e falha com uma mensagem clara se faltar alguma, em vez
de subir "funcionando" e quebrar na primeira request real.

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
     ou pelo Portal logado (/portal, role "cliente")
   → Publicar agora / Agendar → Upload-Post publica nas redes
   → Webhooks de saída notificam sistemas externos em cada etapa
```

Publicar/agendar é bloqueado enquanto houver uma aprovação (interna ou o
link do cliente) pendente ou com ajuste solicitado — ver
[`src/lib/approvals.ts`](./src/lib/approvals.ts).

## Estrutura

```
sql/                          migrations, em ordem (001, 002, 003...) — nunca reescreve, só estende
src/lib/                      clientes das integrações, permissões, aprovações, notificações,
                               rate limit, validação (zod), cifra de credenciais, auth de agente/admin
src/app/(dashboard)/          área logada da agência: clientes, campanhas, tarefas, calendário,
                               analytics, equipe, configurações
src/app/portal/                área logada do cliente final (role "cliente", escopada por client_members)
src/app/admin/                 painel administrativo (super-admin por e-mail, ADMIN_EMAILS)
src/app/aprovacao/, acervo/    páginas públicas sem login (link de aprovação, acervo compartilhado)
src/app/auth/invite/           aceite de convite de equipe
src/app/api/                   rotas server-side (CRUD, integrações, agente, admin, cron)
tests/helpers/                 cliente Supabase fake (em memória) usado pelos testes
```

## Papéis e permissões

`admin`, `gestor`, `designer`, `cliente` têm um conjunto padrão de
permissões (`ROLE_PERMISSIONS` em `src/lib/permissions.ts`). Um admin pode
sobrescrever permissões individualmente por membro em **Equipe**
(`members.custom_permissions`) — alterar `role`/permissões de outro membro
exige ser admin de verdade, não só ter `manageTeam` concedido por override
(evita autopromoção). O role `cliente` usa o Portal (`/portal`), escopado
por `client_members` — nunca enxerga o painel completo da agência.

O painel administrativo (`/admin`) é uma autorização **separada**, por
e-mail (`ADMIN_EMAILS`), nunca por role de organização.

## Segurança

- Headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS)
  em `next.config.ts`.
- Rate limiting em memória (best-effort — ver nota em `src/lib/rate-limit.ts`
  sobre limitações em ambientes serverless) nas rotas públicas/sensíveis.
- Validação de entrada com `zod` (`src/lib/validation.ts`) em toda rota
  exposta a input não confiável, incluindo a API de agente.
- Erros 500 nunca vazam mensagem interna do Postgres em produção
  (`src/lib/errors.ts`).
- Credenciais de integração (Z-API, Telegram, WordPress, Meta Ads, Google
  Drive, webhooks) cifradas em repouso (AES-256-GCM, `src/lib/crypto.ts`) —
  nunca reenviadas em texto puro depois de salvas.
- Tokens de API de agente e webhook secrets: só o hash é guardado
  (`org_agent_tokens`), o valor em texto puro é mostrado uma única vez.
- `error.tsx`/`global-error.tsx` cobrem qualquer erro não tratado — nunca
  mostram stack trace ao usuário.

## Testes

```bash
npm test
```

Suíte com Vitest: lógica pura e rotas de API mockando o cliente Supabase
(`tests/helpers/fake-supabase.ts`) — sem depender de um Supabase real.
Cobre isolamento multi-tenant, bloqueio de operações sem permissão (via
chamada direta à API, não só UI escondida), fluxo de aprovação pública,
escopo do Portal do cliente, webhooks (assinatura/retry) e API de agente.

## CI

`.github/workflows/ci.yml` roda lint, testes e build em todo push/PR pra
`main`.

## Deploy

Pensado para [Vercel](https://vercel.com): configure as variáveis de
ambiente do `.env.example` no projeto, conecte o repositório e os crons de
`vercel.json` são agendados automaticamente. Ver
[`RUNBOOK.md`](./RUNBOOK.md) pro checklist de produção completo.
