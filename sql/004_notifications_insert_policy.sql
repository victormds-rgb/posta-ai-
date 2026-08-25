-- ============================================================================
--  Posta AI — Fase 1 / Bloco 3: notificações internas
--  Rode depois de sql/003_internal_approvals.sql.
--
--  A policy original (notifications_own, de sql/001_init.sql) só permitia
--  user_id = auth.uid() em QUALQUER operação — inclusive insert, o que
--  impedia notificar outra pessoa (ex.: avisar o aprovador de que um
--  conteúdo foi enviado pra revisão). Substituída por policies separadas:
--  leitura/atualização/exclusão continuam restritas ao próprio usuário;
--  insert passa a permitir notificar qualquer membro ativo da mesma org.
-- ============================================================================

drop policy if exists notifications_own on notifications;

create policy notifications_select_own on notifications for select using (
  user_id = auth.uid()
);

create policy notifications_update_own on notifications for update using (
  user_id = auth.uid()
);

create policy notifications_delete_own on notifications for delete using (
  user_id = auth.uid()
);

create policy notifications_insert_org on notifications for insert with check (
  org_id in (select org_id from members where user_id = auth.uid() and status = 'active')
  and user_id in (select m2.user_id from members m2 where m2.org_id = org_id and m2.status = 'active')
);
