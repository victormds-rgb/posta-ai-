-- ============================================================================
--  Posta AI — Tabela de controle de migrations aplicadas
--  Rode depois de sql/012_security_fixes.sql.
-- ============================================================================
--
-- Contexto (achado da auditoria de prontidão): as migrations em sql/ são
-- aplicadas manualmente, uma a uma, no SQL Editor do Supabase — não existe
-- runner nem histórico de "o que já rodou em produção". Isso é arriscado:
-- não dá pra saber, olhando só o banco, se sql/009_analytics_integrations.sql
-- já foi aplicado ou não, e reaplicar um arquivo por engano (sem `if not
-- exists`) pode quebrar o schema.
--
-- Esta tabela não automatiza a aplicação — continua manual, ver README.md —
-- mas dá um registro confiável de quais versões já rodaram nesse projeto
-- Supabase específico. A partir de agora, toda migration nova deve terminar
-- com um insert nela (padrão abaixo).
-- ---------------------------------------------------------------------------

create table if not exists schema_migrations (
  version text primary key,       -- nome do arquivo sem a extensão, ex: '013_schema_migrations'
  applied_at timestamptz not null default now()
);

-- Só o service role deve enxergar isso (mesmo raciocínio de
-- stripe_webhook_events em 012): nenhuma policy pra anon/authenticated.
alter table schema_migrations enable row level security;

-- ---------------------------------------------------------------------------
-- Backfill: registra as migrations 001-012 como já aplicadas. Como elas
-- rodaram antes desta tabela existir, applied_at aqui é o momento do
-- backfill, não a data real em que cada uma foi executada — não temos como
-- recuperar isso retroativamente.
-- ---------------------------------------------------------------------------
insert into schema_migrations (version) values
  ('001_init'),
  ('002_granular_permissions'),
  ('003_internal_approvals'),
  ('004_notifications_insert_policy'),
  ('005_communication'),
  ('006_billing'),
  ('007_portal'),
  ('008_planning'),
  ('009_analytics_integrations'),
  ('010_webhooks_agent'),
  ('011_ai_content'),
  ('012_security_fixes'),
  ('013_schema_migrations')
on conflict (version) do nothing;
