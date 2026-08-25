-- ============================================================================
--  Posta AI — Fase 8: IA para geração de conteúdo (Anthropic)
--  Rode depois de sql/010_webhooks_agent.sql.
--
--  Decisão de coleta de referência (registrada por causa do risco de ToS
--  apontado no ROADMAP): NENHUMA raspagem automática de rede social é
--  feita. `content_sources` só recebe material colado manualmente pela
--  equipe (texto ou link de referência) — a IA analisa o que foi colado,
--  nunca sai coletando conteúdo de terceiros sozinha.
-- ============================================================================

create table if not exists content_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  title varchar(255) not null,
  source_url text,
  raw_text text not null,
  analysis jsonb, -- preenchido quando a IA analisa (resumo, ângulos, nota)
  analyzed_at timestamptz,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_sources_client on content_sources(client_id);

alter table content_sources enable row level security;
create policy content_sources_all on content_sources for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);

-- Fila de rascunhos gerados pela IA — revisados por um humano antes de virar
-- content_item de verdade (aceitar) ou serem descartados.
create table if not exists ai_generations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  campaign_id uuid references campaigns(id) on delete set null,
  brief text not null,
  result jsonb not null, -- { title, caption, carousel_slides: [...], suggested_channels: [...] }
  content_item_id uuid references content_items(id) on delete set null, -- preenchido ao aceitar
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_generations_client on ai_generations(client_id, created_at desc);

alter table ai_generations enable row level security;
create policy ai_generations_all on ai_generations for all using (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active' and role <> 'cliente')
);
