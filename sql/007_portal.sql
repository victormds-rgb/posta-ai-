-- ============================================================================
--  Posta AI — Fase 4: Portal do cliente, acervo digital, brand book
--  Rode depois de sql/006_billing.sql.
-- ============================================================================

-- Escopo de acesso: qual(is) cliente(s) um membro role='cliente' enxerga.
-- Um mesmo membro pode representar mais de um cliente (ex.: agência que
-- atende o mesmo contato em duas contas).
create table if not exists client_members (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (member_id, client_id)
);

create index if not exists idx_client_members_member on client_members(member_id);
create index if not exists idx_client_members_client on client_members(client_id);

alter table client_members enable row level security;

-- Equipe da agência (não-cliente) gerencia os vínculos.
create policy client_members_staff_all on client_members for all using (
  client_id in (
    select c.id from clients c
    join members m on m.org_id = c.org_id
    where m.user_id = auth.uid() and m.status = 'active' and m.role <> 'cliente'
  )
);

-- O próprio cliente só enxerga o vínculo dele.
create policy client_members_self_select on client_members for select using (
  member_id in (select id from members where user_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Brand book — diretrizes de marca por cliente.
-- ---------------------------------------------------------------------------
create table if not exists brand_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null unique,
  primary_color varchar(20),
  secondary_color varchar(20),
  accent_color varchar(20),
  fonts text,
  logo_url text,
  guidelines text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create trigger brand_assets_set_updated_at
  before update on brand_assets
  for each row execute function set_updated_at();

alter table brand_assets enable row level security;

create policy brand_assets_staff_all on brand_assets for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);

create policy brand_assets_client_select on brand_assets for select using (
  client_id in (
    select cm.client_id from client_members cm
    join members m on m.id = cm.member_id
    where m.user_id = auth.uid() and m.status = 'active'
  )
);

-- ---------------------------------------------------------------------------
-- Acervo digital — biblioteca de mídia por cliente, organizada em pastas,
-- com opção de compartilhar uma pasta publicamente (sem login) por token.
-- ---------------------------------------------------------------------------
create table if not exists media_folders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  name varchar(255) not null,
  public_token varchar(64) unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_folders_client on media_folders(client_id);
create index if not exists idx_media_folders_public_token on media_folders(public_token);

create table if not exists media_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  folder_id uuid references media_folders(id) on delete cascade not null,
  name varchar(255) not null,
  url text not null,
  content_type varchar(100),
  size_bytes bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_files_folder on media_files(folder_id);

alter table media_folders enable row level security;
create policy media_folders_staff_all on media_folders for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);
create policy media_folders_client_select on media_folders for select using (
  client_id in (
    select cm.client_id from client_members cm
    join members m on m.id = cm.member_id
    where m.user_id = auth.uid() and m.status = 'active'
  )
);
create policy media_folders_public_select on media_folders for select using (public_token is not null);

alter table media_files enable row level security;
create policy media_files_staff_all on media_files for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);
create policy media_files_client_select on media_files for select using (
  folder_id in (
    select mf.id from media_folders mf
    join client_members cm on cm.client_id = mf.client_id
    join members m on m.id = cm.member_id
    where m.user_id = auth.uid() and m.status = 'active'
  )
);
create policy media_files_public_select on media_files for select using (
  folder_id in (select id from media_folders where public_token is not null)
);
