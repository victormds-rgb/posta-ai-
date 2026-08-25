-- ============================================================================
--  Posta AI — Fase 6: Analytics + integrações de mídia/conteúdo
--  (WordPress, Google Drive, Meta Ads). Rode depois de sql/008_planning.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- WordPress — por cliente (Application Password, sem app revisado por
-- terceiro: mecanismo oficial do próprio WordPress, funciona de verdade
-- assim que o cliente final gerar a senha de aplicativo no site dele).
-- ---------------------------------------------------------------------------
create table if not exists client_wordpress_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null unique,
  site_url text not null,
  username varchar(255) not null,
  app_password text not null, -- cifrado (AES-256-GCM) antes de gravar
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table client_wordpress_config enable row level security;
create policy client_wordpress_config_all on client_wordpress_config for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);

-- Aponta o post espelhado no WordPress, quando o conteúdo foi publicado lá também.
alter table content_items add column if not exists wordpress_post_url text;

-- ---------------------------------------------------------------------------
-- Google Drive — OAuth por organização (exige projeto Google Cloud próprio
-- do produto: GOOGLE_DRIVE_CLIENT_ID/SECRET no .env — dependência externa).
-- ---------------------------------------------------------------------------
create table if not exists org_google_drive_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null unique,
  access_token text not null, -- cifrado
  refresh_token text not null, -- cifrado
  expires_at timestamptz,
  account_email varchar(255),
  connected_at timestamptz not null default now()
);

alter table org_google_drive_config enable row level security;
create policy org_google_drive_config_all on org_google_drive_config for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);

-- ---------------------------------------------------------------------------
-- Meta Ads — por organização (exige app revisado pela Meta pra sair do modo
-- de desenvolvimento: META_APP_ID/SECRET no .env — dependência externa).
-- Guarda um token de acesso de longa duração + a conta de anúncios, ambos
-- gerados fora do produto (Meta Business Suite) e colados na configuração.
-- ---------------------------------------------------------------------------
create table if not exists org_meta_ads_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null unique,
  access_token text not null, -- cifrado
  ad_account_id varchar(100) not null,
  connected_at timestamptz not null default now()
);

alter table org_meta_ads_config enable row level security;
create policy org_meta_ads_config_all on org_meta_ads_config for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);
