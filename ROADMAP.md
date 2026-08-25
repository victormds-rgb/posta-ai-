# Roadmap — Posta AI

> **Natureza do projeto**: produto completo, desenvolvido em fases. "Fases"
> divide a **execução**, não o **escopo final**. Todas as 40 capacidades
> listadas abaixo (derivadas de [`ANALISE-POSTZAP.md`](./ANALISE-POSTZAP.md))
> são consideradas parte do produto — nenhuma foi descartada.

## Como ler este documento

Cada capacidade tem um status:

| Status | Significado |
|---|---|
| ✅ **CONCLUÍDO** | Fluxo ponta a ponta funcionando (UI + API + banco + tratamento de erro), não só "a tela existe". |
| 🟡 **PARCIAL** | Parte do fluxo existe, mas não está completo ponta a ponta — ver nota. |
| 🔵 **EM DESENVOLVIMENTO** | Sendo implementado na fase atual. |
| ⚪ **PLANEJADO** | Ainda não iniciado, com fase definida. |
| 🔴 **BLOQUEADO** | Depende de algo que precisa ser resolvido antes (indicado na nota). |
| 🟣 **DEPENDÊNCIA EXTERNA** | Exige conta/credencial de terceiro antes de poder ser implementado de verdade. |

## Mapa de capacidades (as 40 identificadas na análise)

| # | Capacidade | Status | Fase | Nota |
|---|---|---|---|---|
| 1 | Autenticação | ✅ | 0 | E-mail/senha + Google OAuth via Supabase. Falta: reenvio de confirmação, MFA (fora de escopo por ora). |
| 2 | Multi-tenant | ✅ | 0 | `org_id` + RLS em todas as tabelas de negócio. |
| 3 | Organizações | ✅ | 0 | Criação automática no signup. |
| 4 | Usuários e equipe | 🟡 | 0 / 2 | Convite gera link manual — falta envio automático por e-mail (Fase 2). |
| 5 | Papéis e permissões | 🟡 | 0 / 1 | Fixo por role (`src/lib/permissions.ts`). Matriz granular por membro é a Fase 1. |
| 6 | Clientes | ✅ | 0 | CRUD completo. |
| 7 | Kanban de conteúdo | ✅ | 0 | Drag-and-drop, upload de mídia, todos os status. |
| 8 | Biblioteca/upload de mídia | 🟡 | 0 / 4 | Upload direto no conteúdo existe; biblioteca central reutilizável é o **Acervo digital** (#21, Fase 4). |
| 9 | Aprovação interna | 🟡 | 1 | Status `aprovacao_interna` existe no workflow, mas não há tela/ação dedicada de aprovar internamente (hoje só a aprovação externa por link está completa). |
| 10 | Aprovação pública por link | ✅ | 0 | Token, sem login, aprovar/pedir ajuste. |
| 11 | Publicação em redes sociais | ✅ | 0 | Via Upload-Post, `publish-now`. |
| 12 | Agendamento | ✅ | 0 | `scheduled_at` + cron `/api/cron/process-scheduled`. |
| 13 | Upload-Post | ✅ | 0 | Conectar (JWT), status, publicar, agendar. |
| 14 | WhatsApp via Z-API | ⚪ | 2 | Não implementado — ver seção dedicada abaixo. |
| 15 | Telegram | ⚪ | 2 | Não implementado. |
| 16 | Notificações | 🟡 | 1 | Tabela e RLS existem; **nenhuma rota gera notificações** e não há UI (sino/lista). |
| 17 | E-mail transacional | ⚪ | 2 | Não implementado (Resend). |
| 18 | Billing/assinaturas | ⚪ | 3 | Não implementado (Stripe). |
| 19 | Portal do cliente | ⚪ | 4 | Hoje só existe o link público de aprovação — não há área logada para o cliente final. |
| 20 | Subdomínios | ⚪ | 4 | Roteamento único hoje; `app./cliente./admin.` fica para cá. |
| 21 | Acervo digital | ⚪ | 4 | Biblioteca de mídia compartilhável por cliente. |
| 22 | Brand Book | ⚪ | 4 | — |
| 23 | Planejamento anual | ⚪ | 5 | — |
| 24 | Campanhas | ⚪ | 5 | — |
| 25 | Tarefas | ⚪ | 5 | — |
| 26 | Analytics | ⚪ | 6 | Métricas de posts publicados. |
| 27 | Meta Ads | ⚪ | 6 | 🟣 requer app revisado pela Meta. |
| 28 | Blog/WordPress | ⚪ | 6 | 🟣 requer site WordPress por cliente. |
| 29 | Google Drive | ⚪ | 6 | 🟣 requer projeto Google Cloud + consentimento OAuth revisado. |
| 30 | Webhooks (saída) | ⚪ | 7 | Tabelas `webhook_configs`/`webhook_events` **não existem ainda** no schema atual — migration nova na Fase 7. |
| 31 | API de agente | ⚪ | 7 | Token bearer, endpoints programáticos (`/api/agent/*`). |
| 32 | IA para geração/discovery | ⚪ | 8 | 🟣 requer `ANTHROPIC_API_KEY` (custo por uso). |
| 33 | Painel administrativo | ⚪ | 9 | Super-admin do sistema (todas as orgs). |
| 34 | Auditoria/logs | 🟡 | 1 | `activity_log` é populado por parte das rotas; falta tela de auditoria e cobertura completa. |
| 35 | Permissões granulares | ⚪ | 1 | Matriz por membro (`custom_permissions`), substituindo o fixo por role. |
| 36 | Configurações | 🟡 | 1+ | Hoje só nome/cor/chave Upload-Post; cada fase nova adiciona sua própria seção de configuração. |
| 37 | Segurança | 🟡 | 1 | RLS ok; **faltam** security headers (CSP etc.), rate limiting, validação de entrada consistente (zod já está instalado, não é usado ainda). |
| 38 | Observabilidade | ⚪ | 1 | Sem logging estruturado nem error tracking hoje. |
| 39 | Testes automatizados | ⚪ | 1 | Nenhum teste no projeto hoje. |
| 40 | Preparação para produção | 🟡 | 10 | Build/lint limpos; falta CI, validação de env no boot, error boundaries, backups. |

---

## Fase 0 — Fundação ✅ CONCLUÍDA (base do produto, não mexer sem necessidade)

**Já entregue** (commit `d5af8c1`): autenticação, multi-tenant, organizações,
clientes, kanban de conteúdo, upload de mídia direto no conteúdo, aprovação
pública por link, integração real com Upload-Post (conectar/publicar/
agendar + cron), equipe com convite por link, papéis fixos por role,
configurações básicas da organização.

Esta fase é a base de tudo que segue. **Nenhuma fase futura deve reescrever
esta arquitetura** — apenas estendê-la (novas tabelas, novas rotas, novos
componentes).

---

## Fase 1 — Fechar lacunas da fundação (qualidade, segurança, permissões)

**Objetivo**: completar o que ficou parcial na Fase 0 e estabelecer as bases
de qualidade (segurança, observabilidade, testes) antes de acelerar a
adição de módulos novos — evita acumular dívida técnica nas fases 2+.

**Funcionalidades**: #5 (permissões granulares), #9 (aprovação interna),
#16 (notificações in-app), #34 (auditoria — tela), #37 (segurança), #38
(observabilidade), #39 (testes).

**Dependências**: nenhuma externa — 100% interno ao código já existente.

**Alterações de banco**:
- `members.custom_permissions jsonb` (matriz granular, fallback para
  `DEFAULT_PERMISSIONS[role]` quando `null`).
- `approvals` (tabela nova, tipo `internal`/`external`) **ou** estender
  `approval_links` com `type` — decisão técnica a tomar na fase (ver riscos).
- Garantir triggers de `updated_at` e índices para as consultas de
  auditoria (`activity_log` por `org_id + created_at`, já existe).

**Frontend**: tela de aprovação interna no kanban; sino/lista de
notificações no topbar; editor de permissões por membro em Equipe; tela de
auditoria em Configurações.

**Backend/API**: `POST /api/conteudos/[id]/approve-internal`; geração de
notificações nas rotas existentes (conteúdo criado, aprovação
pedida/respondida, publicação); middleware de validação com `zod` nas
rotas de escrita; rate limiting básico nas rotas públicas (`/api/aprovacao/*`,
`/api/invite/*`).

**Integrações externas**: nenhuma nova. Error tracking (ex.: Sentry) é
🟣 **dependência externa opcional** — decidir se entra aqui ou fica para a
Fase 10.

**Variáveis de ambiente**: nenhuma nova obrigatória; `SENTRY_DSN` opcional
se error tracking entrar nesta fase.

**Testes**: setup de Vitest (unit) + Playwright (E2E) — cobrir: signup →
org criada; criar conteúdo → aprovar por link → publicar; RLS (usuário de
uma org não acessa dados de outra).

**Critérios de conclusão**: aprovação interna funciona ponta a ponta;
notificações aparecem em tempo real na UI; permissões por membro
sobrescrevem o padrão do role; headers de segurança presentes em todas as
respostas; suíte de testes roda em CI local (`npm test`).

---

## Fase 2 — Comunicação e notificações externas

**Objetivo**: tirar a comunicação com clientes de "só link copiado
manualmente" para canais reais — e-mail, WhatsApp, Telegram.

**Funcionalidades**: #4 (convite por e-mail), #14 (WhatsApp/Z-API), #15
(Telegram), #17 (e-mail transacional).

**Dependências**: Fase 1 (notificações in-app já devem existir para
espelhar os eventos que disparam e-mail/WhatsApp/Telegram).

### 2A — E-mail transacional (Resend) 🟣 dependência externa
- **Banco**: `members.email_notifications` (preferências) — já existe o
  tipo em `types.ts`, falta a coluna e a UI.
- **Backend**: `src/lib/email/{send,templates}.ts`; disparo nos eventos de
  convite, aprovação pedida/respondida, resumo semanal (cron).
- **Env vars**: `RESEND_API_KEY`, `EMAIL_FROM` (exige domínio verificado no
  Resend).
- **Testes**: envio real em ambiente de teste (sandbox/domain de teste) +
  snapshot dos templates.
- **Conclusão**: convite, aprovação e resumo semanal chegam por e-mail de
  verdade, com preferências respeitadas.

### 2B — WhatsApp via Z-API 🟣 dependência externa (ver seção dedicada abaixo)

### 2C — Telegram 🟣 dependência externa
- **Banco**: `org_telegram_config` (bot token cifrado, chat/aprovadores).
- **Backend**: `POST /api/telegram/webhook` (recebe respostas do bot),
  `src/lib/telegram.ts` (enviar mensagem/botões inline de aprovar/ajustar).
- **Env vars**: nenhuma global — token do bot é por organização (como o
  Z-API), guardado cifrado no banco, não em `.env`.
- **Testes**: webhook com payload simulado do Telegram; fluxo aprovar via
  botão inline atualiza `approval_links`.
- **Conclusão**: aprovador recebe notificação no Telegram com botões
  aprovar/pedir ajuste, e a ação reflete no kanban.

---

### WhatsApp / Z-API — especificação funcional completa

Conforme pedido explicitamente: **não é opcional nem placeholder**. O fluxo
ponta a ponta exigido é:

```
configuração (org cola instance_id + token)
  → conexão (POST connect)
  → QR Code (GET qr-code, exibido na UI até conectar)
  → status (poll GET status → connected/disconnected)
  → webhook (Z-API chama nosso endpoint em eventos de mensagem/status)
  → recebimento (mensagens do cliente final, ex.: resposta de aprovação por texto)
  → processamento (interpretar "aprovado"/"ajuste: ..." e atualizar approval_links)
  → envio (notificar aprovador quando link de aprovação é gerado)
  → persistência (log de mensagens enviadas/recebidas por org)
  → UI (tela de conexão com QR, status, teste de envio, histórico)
  → tratamento de erro (instância caiu, token inválido, rate limit da Z-API)
  → logs (auditoria de envios/falhas por org)
  → segurança (token da instância cifrado no banco, nunca no client)
  → isolamento (cada org só vê/opera sua própria instância)
  → teste (webhook simulado + envio real em ambiente de teste)
```

Só depois disso tudo passar deve ser marcado ✅.

**Banco**: `org_whatsapp_config` (org_id, instance_id, token **cifrado**,
status, phone, connected_at); `whatsapp_messages` (log de
enviadas/recebidas, direção, status, payload, org_id — RLS por org).

**Backend**: `src/lib/zapi.ts` (cliente — já esboçado na análise, precisa
ser escrito do zero aqui); rotas `POST /api/whatsapp/connect`,
`GET /api/whatsapp/qr`, `GET /api/whatsapp/status`,
`POST /api/whatsapp/disconnect`, `POST /api/whatsapp/webhook` (recebe
eventos da Z-API — validar assinatura/secret do webhook),
`POST /api/whatsapp/send` (uso interno, ex.: notificar aprovação).

**Frontend**: tela em Configurações → Integrações → WhatsApp: colar
credenciais, exibir QR Code, status em tempo real (polling ou realtime),
botão de teste de envio, histórico de mensagens.

**Env vars**: nenhuma global obrigatória — `instance_id`/`token` são por
organização (BYO, como no sistema de referência), guardados cifrados no
banco (**nunca no `.env`**, já que são credenciais por tenant). Se um
fallback global fizer sentido para testes internos, seguir o mesmo padrão
já usado para Upload-Post (`org.upload_post_api_key || env fallback`).

**Riscos** (ver seção de Riscos abaixo): Z-API é uma integração
não-oficial com o WhatsApp — risco de banimento de número, mudanças de API
sem aviso, e é um serviço pago por instância.

---

## Fase 3 — Billing/assinaturas (Stripe) 🟣 dependência externa

**Objetivo**: monetizar — planos, checkout, limites de uso.

**Funcionalidades**: #18.

**Dependências**: conta Stripe (modo teste primeiro), Fase 1 (permissões,
para bloquear features por plano).

**Banco**: `organizations.stripe_customer_id`,
`stripe_subscription_id`, `plan_id`, `subscription_status`,
`current_period_start/end`, `cancel_at_period_end`, `trial_end` (mesmos
campos já mapeados em `ANALISE-POSTZAP.md`).

**Backend**: `src/lib/stripe.ts`; `POST /api/billing/checkout`,
`POST /api/billing/portal`, `POST /api/billing/webhook` (idempotente,
validar assinatura), checagem de limites por plano nas rotas de criação
(clientes, conteúdo).

**Frontend**: tela de planos/preços, upgrade/downgrade, portal de faturas.

**Env vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_*_MONTHLY/ANNUAL` (price IDs, um por plano×intervalo).

**Testes**: webhook com eventos simulados do Stripe CLI; fluxo completo em
modo teste (checkout → assinatura ativa → limite aplicado → cancelamento).

**Conclusão**: usuário assina um plano de verdade (modo teste), limites são
respeitados, cancelamento/downgrade funciona, webhook mantém o banco em
sincronia com o Stripe.

---

## Fase 4 — Portal do cliente, subdomínios, acervo e brand book

**Objetivo**: dar ao cliente final uma área própria (não só o link de
aprovação avulso), e organizar a marca/mídia por cliente.

**Funcionalidades**: #8 (biblioteca completa), #19, #20, #21, #22.

**Dependências**: Fase 1 (permissões — o role `cliente` precisa de escopo
de acesso restrito ao próprio `client_id`), decisão de domínio próprio do
produto antes de subdomínios fazerem sentido (ver Riscos — depende de DNS
real, não de código).

**Banco**: `client_members` (associação membro↔cliente, para restringir o
que um `role: cliente` enxerga); `brand_assets` (brand book: cores,
logos, fontes, diretrizes por cliente); `media_library` (acervo,
com pastas/categorias e flag de compartilhamento público).

**Backend**: rotas `/api/portal/*` (dados do cliente logado), `/api/brand/*`,
`/api/acervo/*`; `src/proxy.ts` ganha lógica de subdomínio (só se o domínio
final do produto já estiver definido).

**Frontend**: `src/app/(portal)/*` — nova área logada para `role: cliente`;
telas de Brand Book e Acervo Digital dentro do painel da agência.

**Integrações externas**: nenhuma nova — subdomínios dependem de DNS
configurado no provedor de hospedagem (Vercel), não de uma API terceira.

**Testes**: RLS garantindo que um `cliente` só vê seu próprio `client_id`;
navegação por subdomínio em ambiente de preview.

**Conclusão**: cliente final loga e vê só o que é dele; acervo e brand book
funcionam por cliente; se subdomínios entrarem nesta fase, `cliente.dominio`
resolve para o portal correto.

---

## Fase 5 — Planejamento e produtividade interna

**Funcionalidades**: #23 (planejamento anual), #24 (campanhas), #25
(tarefas). Módulos internos da agência, sem integração externa — podem ser
paralelizados entre si. **Dependência**: Fase 0 (clientes/conteúdo) apenas.

**Banco**: `campaigns`, `campaign_content_items` (N:N com `content_items`),
`tasks`, `task_comments`.

**Frontend/Backend**: CRUD padrão nos mesmos moldes de `clientes`/
`content_items` já existentes — menor risco técnico do roadmap.

**Conclusão**: campanha agrupa conteúdos e mostra progresso; tarefa tem
dono, prazo, checklist e status; timeline anual visualiza campanhas no
calendário.

---

## Fase 6 — Analytics e integrações de mídia/conteúdo

**Funcionalidades**: #26 (analytics), #27 (Meta Ads 🟣), #28
(WordPress 🟣), #29 (Google Drive 🟣).

**Dependências**: Fase 0 (Upload-Post já publica — analytics lê métricas
de cima disso). Cada integração externa é independente das outras — podem
ser priorizadas conforme a necessidade real do usuário (nem toda agência
usa WordPress ou Meta Ads).

**Banco**: `analytics_snapshots` (métricas por conteúdo/dia),
`org_wordpress_config`, `org_google_drive_config` (tokens OAuth cifrados).

**Env vars**: Meta Ads exige app revisado pela Meta (`META_APP_ID`/
`META_APP_SECRET`); Google Drive exige projeto no Google Cloud Console
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, escopo Drive); WordPress usa
credenciais por cliente (Application Password), sem env var global.

**Conclusão**: gráfico de desempenho por conteúdo publicado; import de
mídia direto do Drive do cliente; publicação espelhada no blog WordPress;
leitura de campanhas ativas do Meta Ads.

---

## Fase 7 — Automação e extensibilidade

**Funcionalidades**: #30 (webhooks de saída), #31 (API de agente).

**Dependências**: quanto mais módulos existirem antes (fases 1–6), mais
eventos o webhook/agente tem para expor — mas tecnicamente só depende da
Fase 0.

**Banco**: `webhook_configs`, `webhook_events` (**tabelas novas** — não
existem no schema atual, diferente do que o sistema de referência já
tinha desde o início).

**Backend**: `src/lib/webhook-dispatch.ts` (assinatura HMAC do payload,
retry com backoff); `/api/agent/*` — réplica funcional (não literal) do
padrão descrito em `AGENT.md` do projeto de referência: token bearer
(`AGENT_API_TOKEN`, aceita CSV para rotação), escopado por `org_id`.

**Env vars**: `AGENT_API_TOKEN`, `AGENT_ORG_ID` (opcional).

**Riscos**: superfície de API pública nova — exige mesma disciplina de
auth/RLS das rotas internas; webhook de saída para URL arbitrária do
usuário é vetor de SSRF se não validado.

**Conclusão**: agência cadastra um webhook e recebe eventos reais
(conteúdo publicado, aprovação respondida); um agente externo consegue
operar a plataforma via token, replicando o fluxo descrito em `AGENT.md`
do sistema de referência.

---

## Fase 8 — IA para geração/discovery de conteúdo 🟣 dependência externa

**Funcionalidades**: #32.

**Dependências**: Fase 5 (campanhas) e Fase 0 (conteúdo) — a IA gera
`content_items` rascunho, não um módulo isolado.

**Banco**: `content_sources`, `discovered_content`, `creation_queue`,
`knowledge_base` (mapeados em `ANALISE-POSTZAP.md`, módulo V4 do sistema
de referência).

**Env vars**: `ANTHROPIC_API_KEY` — **custo por uso**, ver Riscos.

**Riscos**: raspagem de conteúdo de terceiros (Instagram/TikTok) é uma
área cinzenta de ToS das plataformas — decidir explicitamente o método de
coleta (API oficial vs. scraping) antes de implementar.

**Conclusão**: conteúdo de referência é analisado e pontuado; a IA gera
rascunho de carrossel/reels que vira `content_item` no kanban.

---

## Fase 9 — Painel administrativo (super-admin do sistema)

**Funcionalidades**: #33.

**Dependências**: faz mais sentido depois de billing (Fase 3) e analytics
(Fase 6) existirem — senão não há o que mostrar no painel financeiro/uso.

**Banco**: nenhuma tabela nova — consulta as existentes sem RLS (via
service role), com autorização por `ADMIN_EMAILS` (já usado no `.env`
desde a Fase 0, mas ainda sem nenhuma rota que o consuma).

**Frontend/Backend**: `src/app/(admin)/*`, rotas `/api/admin/*` — todas
exigindo checagem explícita de `ADMIN_EMAILS`, nunca role de org.

**Conclusão**: super-admin vê todas as organizações, métricas globais,
logs do sistema e consegue intervir (ex.: mudar plano manualmente).

---

## Fase 10 — Preparação para produção

**Funcionalidades**: #40 (fecha o que ficou como 🟡 na Fase 1/38/39).

**Escopo**: CI (lint + build + testes em PR), validação de env vars no
boot (falhar cedo se faltar uma obrigatória), error boundaries em toda a
árvore, dashboards de observabilidade (se não entrou na Fase 1), política
de backup do Supabase, runbook de incidentes, revisão de segurança final
(headers, RLS, secrets).

**Conclusão**: checklist de produção 100% verde antes de abrir para
clientes pagantes de verdade.

---

## Ordem recomendada e por quê

```
Fase 0  ✅ concluída — não mexer
Fase 1  → primeira a executar: fecha dívida técnica da fundação
          (permissões, aprovação interna, notificações, segurança, testes)
          antes que fases seguintes multipliquem esses gaps.
Fase 2  → comunicação (e-mail, WhatsApp, Telegram) — maior valor percebido
          pelo usuário da agência no dia a dia, e depende só da Fase 1.
Fase 3  → billing — só faz sentido monetizar depois que o produto entrega
          valor de verdade (fases 0–2).
Fase 4  → portal do cliente / acervo / brand book — expande quem usa o
          produto (cliente final), natural depois de billing existir.
Fase 5  → planejamento/campanhas/tarefas — baixo risco técnico, pode
          inclusive ser paralelizada com fases 2–4 se houver capacidade.
Fase 6  → analytics + integrações de mídia — cada uma é opcional/
          independente, priorizar conforme demanda real dos usuários.
Fase 7  → automação (webhooks, API de agente) — mais valiosa quanto mais
          módulos já existirem para expor.
Fase 8  → IA de geração/discovery — maior incerteza de ToS e custo
          variável, fica para quando o core do produto já estiver maduro.
Fase 9  → painel admin — precisa de billing/analytics para ter dado real.
Fase 10 → hardening final antes de produção séria.
```

## Dependências entre fases (resumo)

| Fase | Depende de |
|---|---|
| 1 | 0 |
| 2 | 1 |
| 3 | 0, 1 |
| 4 | 1, (3 recomendado) |
| 5 | 0 |
| 6 | 0 |
| 7 | 0 (mais valiosa após 1–6) |
| 8 | 0, 5 |
| 9 | 3, 6 |
| 10 | todas |

## Riscos técnicos e de negócio

- **Z-API (WhatsApp) é não-oficial**: risco de banimento do número do
  cliente, mudanças de API sem aviso prévio, e é um serviço pago por
  instância conectada — comunicar isso ao usuário final da agência.
- **Meta Ads / Google Drive** exigem app review das respectivas
  plataformas antes de sair do modo de desenvolvimento — prazo fora do
  nosso controle.
- **Subdomínios** dependem de domínio próprio configurado (DNS + certificado
  na Vercel) — não é só código; decidir o domínio final antes da Fase 4.
- **IA de discovery** (Fase 8): coletar conteúdo de redes de terceiros
  levanta questão de ToS — decidir método de coleta antes de implementar,
  não depois.
- **Credenciais por tenant** (Upload-Post, Z-API, Telegram, WordPress,
  Google Drive): todas devem ser **cifradas em repouso** no banco, nunca
  em texto puro — decisão técnica a formalizar na Fase 1 (ex.: `pgsodium`
  do Supabase ou cifra na aplicação antes de persistir).
- **Webhooks de saída** (Fase 7): URL de destino é fornecida pelo usuário
  — validar para evitar SSRF (bloquear IPs privados/localhost).
- **Custos recorrentes** a partir da Fase 2+: Resend, Z-API (por
  instância), Stripe (taxa por transação), Anthropic (por token), Meta/
  Google (grátis, mas com quotas). Nenhum foi contratado ainda — são
  DESCONHECIDO até o usuário decidir qual conta usar.
- **`ADMIN_EMAILS`** já existe no `.env.example` desde a Fase 0 mas hoje
  não é checado em nenhuma rota — é preciso ativar essa checagem só na
  Fase 9, não deixar "meio implementado" entre fases.

## Variáveis de ambiente por fase (novas, além do `.env.example` atual)

| Fase | Variáveis novas |
|---|---|
| 2 | `RESEND_API_KEY`, `EMAIL_FROM` (Z-API e Telegram são por-organização, guardados no banco) |
| 3 | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_*` |
| 4 | `NEXT_PUBLIC_BASE_DOMAIN` (só se subdomínios entrarem nesta fase) |
| 6 | `META_APP_ID`, `META_APP_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (WordPress é por-cliente, sem env global) |
| 7 | `AGENT_API_TOKEN`, `AGENT_ORG_ID` |
| 8 | `ANTHROPIC_API_KEY` |
| 1 (opcional) | `SENTRY_DSN` se error tracking entrar aqui |

Nenhuma credencial de fase futura foi inventada ou adicionada ao
`.env.example` ainda — serão adicionadas na fase correspondente, quando o
usuário fornecer a conta/serviço real.
