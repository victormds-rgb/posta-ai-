-- ============================================================================
--  Posta AI — Fase 3: Billing/assinaturas (Stripe)
--  Rode depois de sql/005_communication.sql.
--
--  `organizations.plan` já existe desde sql/001_init.sql (default 'free').
--  Aqui só adicionamos os campos de vínculo com o Stripe. Esses campos só
--  devem ser escritos pelo webhook (service role) — nenhuma rota de
--  configurações da organização os expõe pra escrita direta pelo usuário.
-- ============================================================================

alter table organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status varchar(30),
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists trial_end timestamptz;

create unique index if not exists idx_organizations_stripe_customer
  on organizations(stripe_customer_id) where stripe_customer_id is not null;

create unique index if not exists idx_organizations_stripe_subscription
  on organizations(stripe_subscription_id) where stripe_subscription_id is not null;

-- Log de eventos do Stripe já processados — evita reprocessar em retry/duplicata.
create table if not exists stripe_webhook_events (
  id text primary key, -- event.id do Stripe
  type text not null,
  processed_at timestamptz not null default now()
);
