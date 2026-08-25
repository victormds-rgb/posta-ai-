-- ============================================================================
--  Posta AI — schema inicial
--  Rode este arquivo no SQL Editor do seu projeto Supabase.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: updated_at automático
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- 1. ORGANIZATIONS (tenant)
-- ============================================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  slug varchar(100) unique not null,
  logo_url text,
  plan varchar(50) not null default 'free',
  brand_color varchar(20) not null default '#6366F1',
  upload_post_api_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

-- ============================================================================
-- 2. MEMBERS (equipe da organização)
-- ============================================================================
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  org_id uuid references organizations(id) on delete cascade not null,
  role varchar(20) not null default 'designer'
    check (role in ('admin', 'gestor', 'designer', 'cliente')),
  display_name varchar(255) not null default '',
  avatar_url text,
  status varchar(20) not null default 'active'
    check (status in ('active', 'pending', 'inactive')),
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

-- ============================================================================
-- 3. INVITES
-- ============================================================================
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  email varchar(255) not null,
  role varchar(20) not null default 'designer',
  token varchar(64) unique not null,
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 4. CLIENTS (clientes da agência)
-- ============================================================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name varchar(255) not null,
  slug varchar(100) not null,
  brand_primary_color varchar(20) default '#6366F1',
  brand_secondary_color varchar(20) default '#818CF8',
  logo_url text,
  contact text,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

-- ============================================================================
-- 5. CLIENT SOCIAL PROFILES (integração Upload-Post)
-- ============================================================================
create table if not exists client_social_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null unique,
  upload_post_username varchar(255) not null unique,
  connected_platforms jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 6. CONTENT ITEMS (workflow / kanban)
-- ============================================================================
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  title varchar(500) not null default 'Sem título',
  content_type varchar(30) not null default 'post'
    check (content_type in ('post', 'carrossel', 'reels', 'story', 'video')),
  description text,
  caption text,
  media_urls jsonb not null default '[]'::jsonb,
  cover_url text,
  channels jsonb not null default '[]'::jsonb,
  status varchar(30) not null default 'ideia'
    check (status in ('ideia', 'producao', 'aprovacao_interna', 'aprovacao_cliente', 'agendado', 'publicado')),
  scheduled_at timestamptz,
  published_at timestamptz,
  upload_post_job_id text,
  created_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger content_items_set_updated_at
  before update on content_items
  for each row execute function set_updated_at();

-- ============================================================================
-- 7. APPROVAL LINKS (aprovação pública por token)
-- ============================================================================
create table if not exists approval_links (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references content_items(id) on delete cascade not null,
  org_id uuid references organizations(id) on delete cascade not null,
  token varchar(64) unique not null,
  status varchar(20) not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'ajuste')),
  reviewer_name varchar(255),
  comment text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  responded_at timestamptz
);

-- ============================================================================
-- 8. NOTIFICATIONS
-- ============================================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  org_id uuid references organizations(id) on delete cascade not null,
  type varchar(50) not null,
  title varchar(255) not null,
  body text,
  read boolean not null default false,
  reference_id uuid,
  reference_type varchar(50),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 9. ACTIVITY LOG
-- ============================================================================
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  action varchar(100) not null,
  entity_type varchar(50),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
create index if not exists idx_members_org on members(org_id);
create index if not exists idx_members_user on members(user_id);
create index if not exists idx_invites_token on invites(token);
create index if not exists idx_clients_org on clients(org_id);
create index if not exists idx_content_items_org on content_items(org_id);
create index if not exists idx_content_items_client on content_items(client_id, status);
create index if not exists idx_content_items_scheduled on content_items(status, scheduled_at)
  where status = 'agendado';
create index if not exists idx_approval_links_token on approval_links(token);
create index if not exists idx_approval_links_content on approval_links(content_id);
create index if not exists idx_notifications_user on notifications(user_id, read, created_at desc);
create index if not exists idx_activity_org on activity_log(org_id, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table organizations enable row level security;
create policy org_select on organizations for select using (
  id in (select org_id from members where user_id = auth.uid() and status = 'active')
);
create policy org_update on organizations for update using (
  id in (select org_id from members where user_id = auth.uid() and role = 'admin' and status = 'active')
);

alter table members enable row level security;
create policy members_select on members for select using (
  org_id in (select org_id from members m where m.user_id = auth.uid() and m.status = 'active')
);
create policy members_insert on members for insert with check (
  org_id in (select org_id from members m where m.user_id = auth.uid() and m.role in ('admin', 'gestor') and m.status = 'active')
  or not exists (select 1 from members m where m.org_id = members.org_id)
);
create policy members_update on members for update using (
  org_id in (select org_id from members m where m.user_id = auth.uid() and m.role = 'admin' and m.status = 'active')
  or user_id = auth.uid()
);
create policy members_delete on members for delete using (
  org_id in (select org_id from members m where m.user_id = auth.uid() and m.role = 'admin' and m.status = 'active')
);

alter table invites enable row level security;
create policy invites_select_org on invites for select using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);
create policy invites_select_token on invites for select using (true);
create policy invites_insert on invites for insert with check (
  org_id in (select org_id from members where user_id = auth.uid() and role in ('admin', 'gestor') and status = 'active')
);
create policy invites_update_token on invites for update using (true);
create policy invites_delete on invites for delete using (
  org_id in (select org_id from members where user_id = auth.uid() and role in ('admin', 'gestor') and status = 'active')
);

alter table clients enable row level security;
create policy clients_all on clients for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

alter table client_social_profiles enable row level security;
create policy client_social_profiles_all on client_social_profiles for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

alter table content_items enable row level security;
create policy content_items_all on content_items for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

-- Aprovação: leitura/atualização pública por token (o cliente final não tem login)
alter table approval_links enable row level security;
create policy approval_links_public_read on approval_links for select using (true);
create policy approval_links_public_update on approval_links for update using (true);
create policy approval_links_org_insert on approval_links for insert with check (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);
create policy approval_links_org_delete on approval_links for delete using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

alter table notifications enable row level security;
create policy notifications_own on notifications for all using (user_id = auth.uid());

alter table activity_log enable row level security;
create policy activity_read on activity_log for select using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);
create policy activity_insert on activity_log for insert with check (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

-- ============================================================================
-- REALTIME (kanban ao vivo)
-- ============================================================================
alter publication supabase_realtime add table content_items;
alter publication supabase_realtime add table notifications;

-- ============================================================================
-- FUNCTIONS / TRIGGERS
-- ============================================================================

-- Cria organização pessoal + membership admin no primeiro cadastro,
-- a menos que o usuário esteja aceitando um convite (metadata.invited_org_id).
create or replace function handle_new_user()
returns trigger as $$
declare
  new_org_id uuid;
  user_name text;
  invited_org uuid;
begin
  invited_org := (new.raw_user_meta_data->>'invited_org_id')::uuid;
  if invited_org is not null then
    return new;
  end if;

  user_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into organizations (name, slug)
  values (
    user_name || 's Workspace',
    lower(regexp_replace(user_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 8)
  )
  returning id into new_org_id;

  insert into members (user_id, org_id, role, display_name, status)
  values (new.id, new_org_id, 'admin', user_name, 'active');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- STORAGE (bucket de mídia)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media_public_read" on storage.objects for select using (bucket_id = 'media');
create policy "media_org_insert" on storage.objects for insert with check (
  bucket_id = 'media' and auth.role() = 'authenticated'
);
create policy "media_org_delete" on storage.objects for delete using (
  bucket_id = 'media' and auth.role() = 'authenticated'
);
