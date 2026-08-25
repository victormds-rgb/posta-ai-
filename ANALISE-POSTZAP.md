# Análise do sistema de referência — [postzap](https://github.com/gabrielkendy/postzap)

Relatório da análise feita no repositório `gabrielkendy/postzap` antes de
implementar o Posta AI. Nenhum código deste repositório foi copiado — a
implementação em `src/` é própria, com schema, nomes e arquitetura
diferentes; este documento serve de referência do que existe no sistema
original e do que foi (ou não) reproduzido.

## 1. Tecnologias e dependências

- **Next.js 16.1.6** (App Router, Turbopack), **React 19.2.3**, TypeScript.
- **Supabase**: `@supabase/ssr` + `@supabase/supabase-js` — Postgres, Auth
  (e-mail/senha + Google OAuth), Storage, Realtime.
- **Stripe** (`stripe` v20) — assinaturas/billing (planos Starter/Pro/Agency).
- **Upload-Post API** — publicação/agendamento em redes sociais
  (Instagram, TikTok, Facebook, YouTube, LinkedIn, Twitter/X, Pinterest).
- **Z-API** — WhatsApp não-oficial (QR code), usado para notificações e
  aprovação via WhatsApp.
- **Telegram Bot API** — bot de aprovação/notificação alternativo.
- **Resend** — envio de e-mails transacionais.
- **googleapis** — integração com Google Drive (importação de mídia) e,
  pelo padrão de rotas, blog em WordPress.
- **Meta Ads** (`lib/meta-ads.ts`) — leitura de contas de anúncio.
- **Anthropic SDK** (`@anthropic-ai/sdk`) — usado no módulo "Content
  Discovery & Factory" (V4) para gerar conteúdo com IA (frameworks do
  "BrandsDecoded").
- **Recharts** — gráficos de analytics.
- UI própria com Radix Tabs + `class-variance-authority` + Tailwind.

## 2. Como o sistema funciona

### Multi-tenant e autenticação
- Cada usuário pertence a uma `organization` via tabela `members`
  (`role`: admin/gestor/designer/cliente). Um trigger Postgres
  (`handle_new_user`) cria automaticamente uma organização + membership
  admin no primeiro cadastro.
- Auth via Supabase (e-mail/senha e Google OAuth). Um `middleware.ts` (na
  verdade `proxy.ts` — Next 16 renomeou Middleware para Proxy) resolve o
  **subdomínio** da requisição (`app.`, `cliente.`, `admin.`, `studio.`) e
  roteia/reescreve para áreas diferentes: painel interno, portal do
  cliente, painel admin do sistema (`ADMIN_EMAILS`) e landing page.
- Permissões: sistema granular por membro (`MemberPermissions`), com
  `DEFAULT_PERMISSIONS` por role e a possibilidade de customizar por
  usuário (`custom_permissions` na tabela `members`) — estilo mLabs.

### Banco de dados (Supabase/Postgres)
Schema espalhado em ~30 migrations incrementais (`sql/*.sql` +
`supabase/migrations/*.sql`), cobrindo (entre outras) as tabelas:
`organizations`, `members`, `invites`, `clientes`, `conteudos`,
`aprovacoes_links`, `messages` (chat), `notifications`, `webhook_configs`/
`webhook_events`, `activity_log`, `social_accounts`, `scheduled_posts`,
`client_assets` (repositório de mídia), `brand_book`, `campanhas`
(planejamento anual), `tasks` (produtividade), `acervos` (acervo digital
público por cliente), tabelas de billing (Stripe) e do módulo V4 de
"Content Discovery" (`content_sources`, `discovered_content`,
`creation_queue`, `knowledge_base`). RLS habilitado em quase todas,
filtrando por `org_id` a partir de `members`.

### Integrações e variáveis de ambiente
Do `.env.example` do projeto original:
- Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) e `ADMIN_EMAILS`/`CRON_SECRET`.
- `AGENT_API_TOKEN`/`AGENT_ORG_ID` — API própria (`/api/agent/*`, ver
  `AGENT.md`) pensada para um agente de IA (Claude) operar a plataforma
  programaticamente: criar clientes, subir conteúdo, gerar link de
  aprovação, publicar.
- `RESEND_API_KEY`/`EMAIL_FROM` — e-mail transacional.
- `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` + um Price ID por
  plano×intervalo — billing.
- `N8N_NOTIFICACAO_WEBHOOK` — automações externas via n8n.
- `UPLOAD_POST_API_KEY`/`UPLOAD_POST_API_URL` — publicação social
  (também configurável por organização).
- `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET`/`TELEGRAM_APPROVAL_CHAT_ID`.
- `NEXT_PUBLIC_BASE_DOMAIN` — habilita o roteamento por subdomínio.
- Login Google configurado dentro do próprio Supabase, não via env var.

### Funcionalidades principais
1. Workflow de conteúdo em kanban por cliente (`backlog → ideia → producao
   → aprovacao_interna → aprovacao → agendado → publicado`).
2. Aprovação por link público com token (cliente final não precisa de
   login) + aprovação interna da equipe + timeline de aprovações.
3. Publicação/agendamento em redes sociais via Upload-Post; conexão de
   contas via widget (JWT).
4. Notificação de aprovação via WhatsApp (Z-API) e/ou Telegram.
5. Portal do cliente (subdomínio `cliente.`) com calendário, solicitações,
   repositório de mídia, brand book, analytics.
6. Painel admin do sistema (subdomínio `admin.`) para gestão de
   organizações, financeiro, logs, acessos.
7. Billing via Stripe (planos, trial, portal de faturas).
8. Acervo digital público por cliente (compartilhamento de arquivos).
9. Módulo de tarefas internas ("Max Tasks") com produtividade.
10. Planejamento anual/campanhas com timeline.
11. Blog (integração WordPress) e Ads (Meta).
12. Módulo V4 "Content Discovery & Factory": raspagem de conteúdo viral de
    referência + geração de conteúdo com IA (Claude) por frameworks
    ("BrandsDecoded").
13. API de agente (`/api/agent/*`) para operação programática via token.

## 3. O que foi reaproveitado vs. refeito no Posta AI

**Reaproveitado (como conceito/arquitetura, não como código):**
- Modelo multi-tenant org → members → clients → conteúdo, com RLS por
  `org_id`.
- Fluxo de aprovação por link público com token opaco.
- Papéis fixos (admin/gestor/designer/cliente) como ponto de partida.
- Uso da Upload-Post para publicação social (mesma API, biblioteca cliente
  própria).
- Padrão de cron para processar publicações agendadas.
- Next.js 16 com `proxy.ts` no lugar de `middleware.ts` (breaking change
  que o próprio ambiente de desenvolvimento já sinalizava).

**Refeito do zero (código, schema e nomes 100% próprios):**
- Todo o schema SQL (`sql/001_init.sql`) — tabelas em inglês, uma única
  migration coesa em vez de ~30 incrementais, RLS reescrita.
- Toda a UI (componentes, layout, kanban com drag-and-drop nativo).
- Cliente Upload-Post (`src/lib/upload-post.ts`) escrito do zero.
- Sistema de permissões simplificado para permissões fixas por role
  (`src/lib/permissions.ts`), sem a matriz granular por membro.

**Deixado de fora da v1 (ver `ROADMAP.md` para detalhes):**
- Roteamento por subdomínio (`app.`/`cliente.`/`admin.`) — v1 usa uma
  única área autenticada.
- Portal dedicado para o cliente final (fora do fluxo de aprovação por
  link).
- WhatsApp (Z-API), Telegram, billing (Stripe), e-mail transacional
  (Resend), webhooks de saída, blog WordPress, Meta Ads.
- Acervo digital público, brand book, planejamento anual/campanhas,
  módulo de tarefas, chat interno, analytics.
- Módulo V4 de descoberta/geração de conteúdo com IA.
- Matriz de permissões granular por membro e painel admin do sistema.
- API de agente (`/api/agent/*`) para operação programática.
