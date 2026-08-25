-- ============================================================================
--  Posta AI — Fase 2: Comunicação (e-mail, WhatsApp/Z-API, Telegram)
--  Rode depois de sql/004_notifications_insert_policy.sql.
--
--  Credenciais de integração por-org (instance_id/token do Z-API, token do
--  bot do Telegram) são guardadas CIFRADAS (ver src/lib/crypto.ts) — nunca
--  em texto puro. Isso exige a env var CREDENTIALS_ENCRYPTION_KEY (ver
--  .env.example) configurada ANTES de qualquer organização conectar
--  WhatsApp ou Telegram.
-- ============================================================================

-- Preferência de receber notificações por e-mail (padrão: sim).
alter table members
  add column if not exists email_notifications boolean not null default true;

-- ---------------------------------------------------------------------------
-- WhatsApp via Z-API — uma instância por organização.
-- ---------------------------------------------------------------------------
create table if not exists org_whatsapp_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null unique,
  instance_id text not null,
  token_encrypted text not null,
  phone text,
  status varchar(20) not null default 'disconnected'
    check (status in ('disconnected', 'connecting', 'connected', 'error')),
  webhook_secret varchar(64) not null default encode(gen_random_bytes(24), 'hex'),
  last_error text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger org_whatsapp_config_set_updated_at
  before update on org_whatsapp_config
  for each row execute function set_updated_at();

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  direction varchar(10) not null check (direction in ('outbound', 'inbound')),
  phone text not null,
  message text,
  status varchar(20) not null default 'sent'
    check (status in ('sent', 'delivered', 'read', 'failed', 'received')),
  provider_message_id text,
  error text,
  reference_id uuid,
  reference_type varchar(50),
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_messages_org on whatsapp_messages(org_id, created_at desc);

create index if not exists idx_whatsapp_config_webhook_secret on org_whatsapp_config(webhook_secret);

alter table org_whatsapp_config enable row level security;
create policy org_whatsapp_config_all on org_whatsapp_config for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

alter table whatsapp_messages enable row level security;
create policy whatsapp_messages_all on whatsapp_messages for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

-- ---------------------------------------------------------------------------
-- Telegram — um bot por organização.
-- ---------------------------------------------------------------------------
create table if not exists org_telegram_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null unique,
  bot_token_encrypted text not null,
  bot_username text,
  approval_chat_id text,
  webhook_secret varchar(64) not null,
  status varchar(20) not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger org_telegram_config_set_updated_at
  before update on org_telegram_config
  for each row execute function set_updated_at();

create index if not exists idx_telegram_config_webhook_secret on org_telegram_config(webhook_secret);

alter table org_telegram_config enable row level security;
create policy org_telegram_config_all on org_telegram_config for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);
