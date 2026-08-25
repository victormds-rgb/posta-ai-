-- ============================================================================
--  Posta AI — Fase 5: Planejamento anual, campanhas e tarefas
--  Rode depois de sql/007_portal.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Campanhas — agrupam conteúdos num período, com progresso derivado do
-- status dos itens vinculados (campaign_content_items).
-- ---------------------------------------------------------------------------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  name varchar(255) not null,
  description text,
  color varchar(20),
  start_date date,
  end_date date,
  status varchar(20) not null default 'planejada' check (status in ('planejada', 'em_andamento', 'concluida', 'cancelada')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaigns_org on campaigns(org_id);
create index if not exists idx_campaigns_client on campaigns(client_id);

create trigger campaigns_set_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

alter table campaigns enable row level security;

-- Módulo interno da agência — mesmo padrão de content_items (toda a org,
-- não escopado por client_members: cliente final não usa campanhas/tarefas).
create policy campaigns_all on campaigns for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

create table if not exists campaign_content_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade not null,
  content_item_id uuid references content_items(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, content_item_id)
);

create index if not exists idx_campaign_content_items_campaign on campaign_content_items(campaign_id);
create index if not exists idx_campaign_content_items_content on campaign_content_items(content_item_id);

alter table campaign_content_items enable row level security;

create policy campaign_content_items_all on campaign_content_items for all using (
  campaign_id in (
    select c.id from campaigns c
    join members m on m.org_id = c.org_id
    where m.user_id = auth.uid() and m.status = 'active'
  )
);

-- ---------------------------------------------------------------------------
-- Tarefas — dono, prazo, checklist (jsonb, sem tabela própria: menor risco
-- técnico pra um checklist curto por tarefa) e comentários.
-- ---------------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  content_item_id uuid references content_items(id) on delete set null,
  title varchar(500) not null,
  description text,
  status varchar(20) not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida')),
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  checklist jsonb not null default '[]',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_org on tasks(org_id);
create index if not exists idx_tasks_assigned on tasks(assigned_to);
create index if not exists idx_tasks_campaign on tasks(campaign_id);

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

alter table tasks enable row level security;

create policy tasks_all on tasks for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  task_id uuid references tasks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task on task_comments(task_id);

alter table task_comments enable row level security;

create policy task_comments_all on task_comments for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);
