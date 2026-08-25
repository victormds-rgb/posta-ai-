-- ============================================================================
--  Posta AI — Fase 1 / Bloco 2: aprovação interna
--  Rode depois de sql/002_granular_permissions.sql.
--
--  Tabela nova e isolada — não altera approval_links (aprovação pública
--  externa), que continua funcionando exatamente como está.
-- ============================================================================

create table if not exists internal_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  content_id uuid references content_items(id) on delete cascade not null,
  status varchar(20) not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'ajuste')),
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  comment text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_internal_approvals_content on internal_approvals(content_id, created_at desc);
create index if not exists idx_internal_approvals_org_status on internal_approvals(org_id, status);

alter table internal_approvals enable row level security;

-- Só membros ativos da própria organização — sem acesso público (diferente
-- de approval_links, que é acessado por token sem login).
create policy internal_approvals_all on internal_approvals for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
);

alter publication supabase_realtime add table internal_approvals;
