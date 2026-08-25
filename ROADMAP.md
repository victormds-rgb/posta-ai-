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
| 4 | Usuários e equipe | 🟡 | 0 / 2 | Convite gera link manual — falta envio automático por e-mail (Fase 2). Já tem: papel + permissões customizadas por membro. |
| 5 | Papéis e permissões | ✅ | 0 / 1 | Padrão fixo por role + override granular por membro (`members.custom_permissions`), aplicado no servidor em todas as rotas de escrita — não só escondendo botão. Alterar role/permissões de outro membro exige admin de verdade. |
| 6 | Clientes | ✅ | 0 | CRUD completo. |
| 7 | Kanban de conteúdo | ✅ | 0 | Drag-and-drop, upload de mídia, todos os status. |
| 8 | Biblioteca/upload de mídia | ✅ | 0 / 4 | Upload direto no conteúdo + biblioteca central reutilizável (**Acervo digital**, #21, pastas por cliente com link público). |
| 9 | Aprovação interna | ✅ | 1 | Fluxo completo: solicitar → aprovar/pedir ajuste (com motivo) → histórico (`internal_approvals`) → publicar/agendar bloqueado enquanto pendente ou com ajuste em aberto. |
| 10 | Aprovação pública por link | ✅ | 0 | Token, sem login, aprovar/pedir ajuste. |
| 11 | Publicação em redes sociais | ✅ | 0 | Via Upload-Post, `publish-now`. |
| 12 | Agendamento | ✅ | 0 | `scheduled_at` + cron `/api/cron/process-scheduled`. |
| 13 | Upload-Post | ✅ | 0 | Conectar (JWT), status, publicar, agendar. |
| 14 | WhatsApp via Z-API | ⚪ | 2 | Não implementado — ver seção dedicada abaixo. |
| 15 | Telegram | ⚪ | 2 | Não implementado. |
| 16 | Notificações | ✅ | 1 | In-app: sino no topbar, lida/não lida, isoladas por usuário (RLS). Gerada nos eventos de aprovação (solicitada/aprovada/ajuste, interna e externa), equipe (novo membro) e permissões alteradas. E-mail/WhatsApp/Telegram continuam na Fase 2. |
| 17 | E-mail transacional | ⚪ | 2 | Não implementado (Resend). |
| 18 | Billing/assinaturas | ⚪ | 3 | Não implementado (Stripe). |
| 19 | Portal do cliente | ✅ | 4 | Área logada em `/portal` (`role: cliente`), escopada por `client_members` — conteúdo, brand book e acervo do(s) cliente(s) vinculados. |
| 20 | Subdomínios | 🔴 | 4 | Não implementado — depende de domínio de produção definitivo (DNS + cert wildcard), decisão de infraestrutura fora do código. Portal por path (`/portal`) cobre a mesma necessidade funcional por ora. |
| 21 | Acervo digital | ✅ | 4 | Pastas de mídia por cliente, upload, exclusão, link público opcional sem login (`/acervo/[token]`). |
| 22 | Brand Book | ✅ | 4 | Cores, fontes, logo e diretrizes por cliente; editável pela agência, visível pro cliente no Portal. |
| 23 | Planejamento anual | ✅ | 5 | Via campanhas com período (início/fim) + calendário — sem grade visual anual dedicada. |
| 24 | Campanhas | ✅ | 5 | Agrupam conteúdos de um cliente, com status e progresso (X/Y publicados). |
| 25 | Tarefas | ✅ | 5 | Responsável, prazo, checklist e comentários. |
| 26 | Analytics | ⚪ | 6 | Métricas de posts publicados. |
| 27 | Meta Ads | ⚪ | 6 | 🟣 requer app revisado pela Meta. |
| 28 | Blog/WordPress | ⚪ | 6 | 🟣 requer site WordPress por cliente. |
| 29 | Google Drive | ⚪ | 6 | 🟣 requer projeto Google Cloud + consentimento OAuth revisado. |
| 30 | Webhooks (saída) | ⚪ | 7 | Tabelas `webhook_configs`/`webhook_events` **não existem ainda** no schema atual — migration nova na Fase 7. |
| 31 | API de agente | ⚪ | 7 | Token bearer, endpoints programáticos (`/api/agent/*`). |
| 32 | IA para geração/discovery | ⚪ | 8 | 🟣 requer `ANTHROPIC_API_KEY` (custo por uso). |
| 33 | Painel administrativo | ⚪ | 9 | Super-admin do sistema (todas as orgs). |
| 34 | Auditoria/logs | 🟡 | 1 / 9 | `activity_log` é populado por mais rotas agora (permissões, aprovações); ainda falta uma **tela** de auditoria — fica natural junto do painel admin (Fase 9). |
| 35 | Permissões granulares | ✅ | 1 | `members.custom_permissions` (override parcial sobre o padrão do role), com UI de edição em Equipe e enforcement no servidor em toda rota de escrita. |
| 36 | Configurações | 🟡 | 1+ | Nome/cor/chave Upload-Post (chave nunca é reexibida depois de salva). Cada fase nova adiciona sua própria seção. |
| 37 | Segurança | ✅ | 1 | RLS + headers (CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy) + rate limiting best-effort nas rotas públicas/sensíveis + validação de entrada com zod + erros 500 sem vazar detalhe interno + secret da Upload-Post nunca reenviado ao cliente. Falta pra uma versão "definitiva": CSP com nonce, rate limit num store externo (Fase 10). |
| 38 | Observabilidade | 🟡 | 1 / 10 | Erros de servidor logados (`console.error`, capturado pela Vercel) sem vazar detalhe ao cliente. Ainda falta logging estruturado e error tracking dedicado (Sentry ou similar) — Fase 10. |
| 39 | Testes automatizados | ✅ | 1 | Primeira suíte (Vitest): lógica pura (permissões, validação, tokens, rate limit, gate de aprovação) + rotas de API com Supabase mockado (`tests/helpers/fake-supabase.ts`) — isolamento multi-tenant, bloqueio de operação sem permissão via chamada direta à API, fluxo de aprovação pública (token válido/inválido/expirado). Cobertura cresce nas fases seguintes, não é exaustiva ainda. |
| 40 | Preparação para produção | 🟡 | 10 | Build/lint/testes limpos. Falta CI, validação de env no boot, error boundaries, backups. |

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

## Fase 1 — Fechar lacunas da fundação (qualidade, segurança, permissões) ✅ CONCLUÍDA

**Objetivo**: completar o que ficou parcial na Fase 0 e estabelecer as bases
de qualidade (segurança, observabilidade, testes) antes de acelerar a
adição de módulos novos — evita acumular dívida técnica nas fases 2+.

**Entregue**: permissões granulares por membro (#5), aprovação interna
ponta a ponta (#9), notificações in-app (#16), headers/CSP/rate limiting/
validação/tratamento de erro (#37), primeira suíte de testes automatizados
(#39). Auditoria (#34) e observabilidade avançada (#38) ficaram parcialmente
cobertas — o resto migrou pra Fases 9 e 10 respectivamente (ver mapa de
capacidades acima e o relatório da Fase 1 entregue na conversa).

**Funcionalidades** (escopo original, referência): #5 (permissões
granulares), #9 (aprovação interna), #16 (notificações in-app), #34
(auditoria — tela), #37 (segurança), #38 (observabilidade), #39 (testes).

**Dependências**: nenhuma externa — 100% interno ao código já existente.

**Alterações de banco** (aplicadas — `sql/002` a `sql/004`):
- `members.custom_permissions jsonb` (override parcial sobre o padrão do
  role, `null` = usa o padrão).
- `internal_approvals` — tabela nova e isolada pra aprovação interna
  (decisão tomada: **não** unificar com `approval_links`, que já
  funcionava pra aprovação externa por token público — schemas e regras de
  RLS diferentes o bastante pra não valer a refatoração).
- RLS de `notifications` separada em policies por operação — a policy
  original só deixava inserir notificação pra si mesmo, o que impedia
  notificar outra pessoa (ex.: avisar o aprovador).

**Frontend**: painel de aprovação interna dentro do modal de conteúdo
(`InternalApprovalPanel`); sino de notificações no topbar; editor de
permissões por membro em Equipe (`PermissionsModal`). Tela de auditoria
dedicada ficou pra Fase 9 (painel admin).

**Backend/API**: `POST /api/conteudos/[id]/internal-approval` (solicitar),
`POST .../decision` (aprovar/ajustar), `GET .../internal-approval`
(histórico); `assertContentIsPublishable` bloqueando `publish-now`/
`schedule`/cron quando há aprovação pendente/ajuste; `/api/notificacoes`
(listar, marcar lida, marcar todas); validação com `zod`
(`src/lib/validation.ts`) nas rotas de maior exposição a input não
confiável; rate limiting em memória (`src/lib/rate-limit.ts`) nas rotas
públicas (`/api/aprovacao/*`, `/api/invite/*`) e sensíveis (upload de
mídia, criação de convite).

**Integrações externas**: nenhuma nova. Error tracking dedicado (ex.:
Sentry) **não entrou** nesta fase — fica como 🟣 dependência externa
opcional pra Fase 10; por ora, erros de servidor são logados via
`console.error` (capturado pela Vercel).

**Variáveis de ambiente**: nenhuma nova.

**Testes**: suíte Vitest (unit + rotas de API com Supabase mockado) — ver
`src/lib/__tests__/` e `src/app/api/**/__tests__/`. E2E com navegador real
(Playwright) não entrou nesta fase — as rotas já são testadas ponta a
ponta ao nível de HTTP/lógica, mas não há teste de UI clicando na tela.

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

## Fase 4 — Portal do cliente, subdomínios, acervo e brand book ✅ CONCLUÍDA (exceto subdomínios)

**Objetivo**: dar ao cliente final uma área própria (não só o link de
aprovação avulso), e organizar a marca/mídia por cliente.

**Entregue**: `client_members` (escopo de acesso do role `cliente`,
aplicado no servidor — não só RLS de organização), Portal do cliente
(`/portal`, `/portal/brand`, `/portal/acervo`), Brand Book por cliente
(`/clientes/[slug]/brand`), Acervo digital com pastas e compartilhamento
por link público sem login (`/clientes/[slug]/acervo`,
`/acervo/[token]`), gestão de quais clientes cada membro `cliente` enxerga
(dentro do editor de permissões em Equipe).

**Funcionalidades**: #8 (biblioteca completa) ✅, #19 (portal) ✅, #20
(subdomínios) ⚪ — ver nota abaixo, #21 (acervo) ✅, #22 (brand book) ✅.

**Dependências**: Fase 1 (permissões — o role `cliente` precisa de escopo
de acesso restrito ao próprio `client_id`) ✅ usada.

**Alterações de banco** (`sql/007_portal.sql`): `client_members`
(membro↔cliente); `brand_assets` (cores, fontes, logo, diretrizes,
`unique(client_id)`); `media_folders` (pasta por cliente, `public_token`
opcional pra link sem login) e `media_files` (arquivo dentro da pasta,
reaproveita o bucket `media` já existente do Supabase Storage — nenhum
bucket novo foi necessário). RLS em todas: staff da agência tem acesso
total à sua org; membro `cliente` só lê via `client_members`; pasta/
arquivo com `public_token` fica de leitura pública.

**Decisão de arquitetura registrada**: a Fase 1 já deixou o `role:
cliente` com permissões zeradas para escrita, mas as rotas `GET
/api/clientes` e `GET /api/conteudos` liam por organização inteira, sem
olhar pra `client_id` — ou seja, um membro `cliente` conseguia listar
todos os clientes/conteúdos da agência via chamada direta à API (gap
pré-existente, não introduzido nesta fase). Fechado nesta fase: essas
duas rotas agora restringem a leitura de um membro `cliente` aos
`client_id`s vinculados via `client_members`, e o layout de `/clientes`
(agência) redireciona qualquer `role: cliente` para `/portal`. Seguindo o
mesmo padrão já estabelecido na Fase 1 (enforcement de permissão na
camada de aplicação, não reescrevendo as policies de RLS existentes),
para não mexer no que já funcionava pras demais roles.

**Subdomínios (#20)**: **não implementado nesta fase, por decisão
deliberada** — depende de um domínio de produção real (DNS + certificado
wildcard) que este projeto ainda não tem definido; ver `src/proxy.ts` para
o ponto de extensão já preparado. O Portal (`/portal`) entrega o mesmo
resultado funcional por caminho (path), sem depender de infraestrutura de
domínio — fica pendente pra quando o domínio final for decidido (ver
seção de pendências/manual no relatório final).

**Backend**: `POST/GET /api/clientes/[id]/brand`, `/api/clientes/[id]/
acervo/pastas` (+ `[folderId]`, `+/arquivos`), `DELETE /api/acervo/
arquivos/[fileId]`, `GET /api/acervo/publico/[token]` (público, rate
limited), `GET/PUT /api/equipe/[id]/clientes` (vincula membro↔cliente).

**Frontend**: `src/app/portal/*` (nova área logada pro `role: cliente`,
com sidebar própria), `clientes/[slug]/brand` e `clientes/[slug]/acervo`
no painel da agência, `acervo/[token]` (link público sem login).

**Testes**: isolamento do Portal por `client_members` (lib e rotas),
brand book (staff sempre lê, `cliente` só o seu), acervo (isolamento por
org/cliente, link público, permissão de escrita), vínculo membro↔cliente
via Equipe.

**Conclusão**: cliente final loga em `/portal` e vê só o que é dele;
acervo e brand book funcionam por cliente, com opção de link público pro
acervo. Subdomínio `cliente.dominio` fica como pendência de
infraestrutura, não de código.

---

## Fase 5 — Planejamento e produtividade interna ✅ CONCLUÍDA

**Entregue**: Campanhas (`/campanhas`, `/campanhas/[id]`) agrupando
conteúdos de um cliente por período, com status e progresso (X/Y
publicados); Tarefas (`/tarefas`) com responsável, prazo, checklist e
comentários; campanhas ativas visíveis no Calendário.

**Funcionalidades**: #23 (planejamento anual — via campanhas + calendário)
✅, #24 (campanhas) ✅, #25 (tarefas) ✅. Módulos internos da agência, sem
integração externa. **Dependência**: Fase 0 (clientes/conteúdo) apenas —
usada.

**Alterações de banco** (`sql/008_planning.sql`): `campaigns` (por
cliente, status, período), `campaign_content_items` (N:N com
`content_items`, `unique(campaign_id, content_item_id)`), `tasks`
(checklist como `jsonb` embutido — sem tabela própria, menor risco técnico
pra um checklist curto por tarefa), `task_comments`. RLS: mesmo padrão de
`content_items` — toda a organização (não escopado por `client_members`;
campanhas/tarefas são módulo interno da agência, o role `cliente` nem
enxerga estas rotas).

**Decisão de arquitetura registrada**: campanhas e tarefas reaproveitam a
permissão `manageContent` já existente (em vez de criar novas chaves em
`RolePermissions`, o que exigiria migrar `members.custom_permissions` e
tocar em toda a suíte de testes de permissões da Fase 1) — a chave já
cobre exatamente quem deveria poder planejar/organizar conteúdo.

**Backend**: `/api/campanhas` (+ `[id]`, `+/conteudos` pra vincular/
desvincular conteúdo — valida que é do mesmo cliente da campanha),
`/api/tarefas` (+ `[id]`, `+/comentarios`).

**Frontend**: `/campanhas` (lista + criação), `/campanhas/[id]` (detalhe,
progresso, vincular/desvincular conteúdo, mudar status), `/tarefas`
(lista com filtro por status, modal de criação/edição com checklist e
comentários), seção "Campanhas ativas" no Calendário.

**Testes**: isolamento por organização, vínculo campanha↔conteúdo restrito
ao mesmo cliente, checklist/comentários de tarefa, bloqueio do role
`cliente` (módulo interno).

**Conclusão**: campanha agrupa conteúdos e mostra progresso; tarefa tem
dono, prazo, checklist e status; campanhas aparecem no calendário. Uma
grade visual de calendário anual completa (dia-a-dia, mês a mês) não
entrou nesta fase — a lista de campanhas ativas + calendário de conteúdo
agendado já existente cobrem a necessidade funcional; fica como polimento
futuro, não como lacuna funcional.

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
