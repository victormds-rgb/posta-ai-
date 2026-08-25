-- ============================================================================
--  Posta AI — Fase 1 / Bloco 1: permissões granulares por membro
--  Rode depois de sql/001_init.sql.
-- ============================================================================

-- Override de permissões por membro. Quando null, o membro usa o padrão do
-- seu role (ROLE_PERMISSIONS em src/lib/permissions.ts). Quando presente, é
-- mesclado sobre o padrão do role (chaves ausentes continuam usando o
-- padrão) — a lógica de merge vive na aplicação (src/lib/permissions.ts),
-- não no Postgres.
alter table members
  add column if not exists custom_permissions jsonb;

comment on column members.custom_permissions is
  'Override parcial de RolePermissions (src/lib/permissions.ts). Null = usa o padrão do role.';
