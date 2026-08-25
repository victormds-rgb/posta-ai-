-- ============================================================================
--  Posta AI — Fase 7: Webhooks de saída e API de agente
--  Rode depois de sql/009_analytics_integrations.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Webhooks de saída — a organização cadastra uma URL própria e escolhe quais
-- eventos quer receber. Payload assinado com HMAC-SHA256 (secret cifrado).
-- ---------------------------------------------------------------------------
create table if not exists webhook_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  url text not null,
  secret text not null, -- cifrado (AES-256-GCM) — usado pra assinar o payload
  events text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_configs_org on webhook_configs(org_id);

alter table webhook_configs enable row level security;
create policy webhook_configs_all on webhook_configs for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);

-- Log de entrega + fila de retry (fallback quando a 1a tentativa síncrona falha).
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  webhook_config_id uuid references webhook_configs(id) on delete cascade not null,
  event_type varchar(100) not null,
  payload jsonb not null,
  status varchar(20) not null default 'pending' check (status in ('pending', 'success', 'failed')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_events_config on webhook_events(webhook_config_id, created_at desc);
create index if not exists idx_webhook_events_retry on webhook_events(status, next_attempt_at) where status in ('pending', 'failed');

alter table webhook_events enable row level security;
create policy webhook_events_staff_select on webhook_events for select using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);

-- ---------------------------------------------------------------------------
-- Tokens de API de agente — por organização (não um único token global):
-- cada org gera/revoga seus próprios tokens, como uma API key de SaaS.
-- Guarda só o hash (sha256), nunca o token em texto puro (mesmo padrão de
-- senha — se vazar o banco, o token não é recuperável).
-- ---------------------------------------------------------------------------
create table if not exists org_agent_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name varchar(255) not null,
  token_hash varchar(64) unique not null,
  token_prefix varchar(12) not null,
  created_by uuid references auth.users(id) on delete set null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_agent_tokens_org on org_agent_tokens(org_id);
create index if not exists idx_org_agent_tokens_hash on org_agent_tokens(token_hash);

alter table org_agent_tokens enable row level security;
create policy org_agent_tokens_all on org_agent_tokens for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);
