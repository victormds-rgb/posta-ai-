# Runbook de produção — Posta AI

Checklist e procedimentos operacionais para rodar o produto em produção
de verdade, com clientes pagantes. Complementa o [`README.md`](./README.md)
(setup) e o [`ROADMAP.md`](./ROADMAP.md) (o que existe, por fase, e o que
ainda depende de credencial externa).

## Checklist antes de abrir para clientes pagantes

- [ ] Todas as migrations de `sql/` rodadas em ordem no projeto Supabase de
      produção (não o de desenvolvimento) — confirme com
      `select version from schema_migrations order by version;`
      (tabela criada em `013_schema_migrations.sql`).
- [ ] `.env` de produção preenchido com as variáveis **obrigatórias**
      (Supabase, `ADMIN_EMAILS`, `CRON_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`
      — gerada com `openssl rand -hex 32`, **nunca reaproveitada** de
      desenvolvimento).
- [ ] `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` e os 6 Price IDs em modo
      **live** (não teste) se for cobrar de verdade — ver Fase 3 no
      `ROADMAP.md`.
- [ ] Webhook do Stripe apontando pra
      `https://SEU-DOMINIO/api/billing/webhook` no dashboard do Stripe
      (modo live).
- [ ] `NEXT_PUBLIC_APP_URL` apontando pro domínio real de produção (usado
      em todo link gerado — convite, aprovação, callback do Google Drive).
- [ ] `CI` verde na branch de deploy (`.github/workflows/ci.yml`: lint,
      testes, build).
- [ ] Backup do Supabase confirmado (ver seção abaixo).
- [ ] Domínio com HTTPS ativo — o header `Strict-Transport-Security`
      definido em `next.config.ts` só tem efeito real sob HTTPS.
- [ ] Login com Google configurado no Supabase (se for usado) com a URL de
      produção nas Redirect URLs autorizadas.
- [ ] Conferir que nenhuma credencial de teste (Stripe test mode, chave
      Upload-Post de sandbox) ficou configurada como fallback global.

## Backup e recuperação

O banco é 100% gerenciado pelo Supabase — a política de backup é a do
plano contratado lá, não algo que este repositório controla:

- **Plano Free do Supabase**: sem backup automático além do que o próprio
  Postgres mantém por padrão. **Não é adequado pra produção com clientes
  pagantes.**
- **Plano Pro+ do Supabase**: backups diários automáticos (retenção
  conforme o plano) e, em planos mais altos, **Point-in-Time Recovery**
  (PITR) — restaura pra qualquer segundo dentro da janela de retenção.

**Ação necessária antes de produção séria**: confirmar no dashboard do
Supabase (Project Settings → Backups) que o plano contratado tem backup
automático ativo, e testar uma restauração pelo menos uma vez num projeto
de staging antes de precisar de verdade.

Storage (bucket `media`): não tem backup separado do banco — os arquivos
ficam no Supabase Storage, que segue a mesma política de durabilidade da
infraestrutura do Supabase (não do plano de backup do Postgres).

## Runbook de incidentes

### Publicação parou de funcionar (Upload-Post)

1. Checar `/api/cron/process-scheduled` nos logs do Vercel (cron rodando?
   erro de rede? chave inválida?).
2. Testar `POST /api/posts/publish-now` manualmente com um conteúdo de
   teste — o erro retornado vem direto da Upload-Post.
3. Confirmar que a chave (org ou fallback global) não expirou/foi
   revogada no painel da Upload-Post.

### Webhooks de saída não estão sendo entregues

1. Ver o log de entrega em **Configurações → Webhooks e API de agente**
   (por webhook) — mostra o `last_error` de cada tentativa.
2. Confirmar que `/api/cron/retry-webhooks` está rodando (Vercel → Cron
   Jobs) — sem ele, só a 1ª tentativa síncrona acontece.
3. Depois de 5 tentativas (~9h de backoff), o evento fica `failed`
   permanentemente — nesse caso, o problema é do lado do destinatário
   (URL fora do ar, certificado inválido, etc.), não do produto.

### Erro 500 recorrente numa rota

1. Toda `serverError()` loga `console.error('[context]', error)` — os
   logs do Vercel (ou `vercel logs`) mostram o contexto e o erro real
   (nunca exposto ao cliente em produção, só nesse log).
2. Confirmar que não é falta de env var — `src/instrumentation.ts` só
   valida as obrigatórias no boot; uma integração opcional mal configurada
   falha na hora do uso, com uma mensagem específica na resposta da rota.

### RLS bloqueando algo que deveria funcionar

1. Toda tabela nova de cada fase tem sua policy documentada no próprio
   arquivo `sql/0XX_*.sql` — comparar o padrão da tabela com problema
   contra uma tabela equivalente que já funciona (ex.: `client_members`
   pro padrão de escopo do Portal).
2. **Nunca** desabilitar RLS numa tabela de produção pra "resolver rápido"
   — isso abre acesso cross-tenant. Corrigir a policy, não removê-la.

### Suspeita de credencial vazada

1. Credenciais de integração (Z-API, Telegram, WordPress, Meta Ads,
   Google Drive) são cifradas em repouso, mas se `CREDENTIALS_ENCRYPTION_KEY`
   vazar, todas ficam comprometidas — trocar a chave invalida (não
   decifra mais) as credenciais salvas, forçando reconexão de todas as
   integrações de todas as organizações. É uma ação disruptiva — só fazer
   se a chave realmente vazou.
2. Tokens de agente e webhook secrets: só o hash está no banco — revogar
   pela UI (**Configurações → Webhooks e API de agente**) é suficiente,
   não precisa rotacionar nada global.

## Observabilidade

- `GET /api/health` — health check público (sem auth), pra apontar um
  monitor de uptime (UptimeRobot, o healthcheck da própria plataforma de
  deploy, etc.). Confirma só que o processo está de pé e que o Supabase
  responde (`{status:"ok"}` / 200 ou `{status:"degraded"}` / 503) — não
  devolve nenhum dado de tenant.
- Erros de servidor: `console.error` estruturado (`[contexto] erro`),
  capturado pelos logs da Vercel. Não há error tracking dedicado (Sentry
  ou similar) integrado ainda — é uma dependência externa opcional
  (exigiria `@sentry/nextjs` + DSN próprio) deliberadamente não adicionada
  nesta fase, pra não crescer o bundle/dependências sem necessidade
  comprovada. Fica como próximo passo natural se o volume de erros em
  produção justificar.
- `error.tsx`/`global-error.tsx` garantem que nenhum erro não tratado vira
  tela branca pro usuário.
- Auditoria: `/admin/auditoria` (super-admin) mostra os últimos 100
  eventos de `activity_log` de todas as organizações.
