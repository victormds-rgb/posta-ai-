# Roadmap

O que já está funcionando está descrito no [`README.md`](./README.md). Este
documento lista o que fica para as próximas fases, na ordem sugerida —
inspirado no que existe no sistema de referência (ver
[`ANALISE-POSTZAP.md`](./ANALISE-POSTZAP.md)), mas a implementar com código
próprio.

## Fase 2 — Notificações e comunicação
- [ ] E-mail transacional (Resend): avisos de nova aprovação, resposta de
      aprovação, resumo semanal.
- [ ] Notificação de aprovação via WhatsApp (Z-API) — cada organização traz
      sua própria instância.
- [ ] Notificações in-app (tabela `notifications` já existe no schema —
      falta UI de sino/lista).
- [ ] Chat interno por conteúdo/cliente.

## Fase 3 — Billing
- [ ] Assinaturas via Stripe (planos, trial, checkout, portal de faturas,
      webhook de billing).
- [ ] Limites por plano (nº de clientes, conteúdos/mês).

## Fase 4 — Portal do cliente e acesso externo
- [ ] Área dedicada para o `role: cliente` fora do fluxo de link público:
      login próprio, calendário, solicitações, repositório de mídia.
- [ ] Roteamento por subdomínio (`app.`/`cliente.`/`admin.`), se fizer
      sentido para o domínio final do produto.
- [ ] Acervo digital compartilhável publicamente por cliente.

## Fase 5 — Permissões e administração
- [ ] Matriz de permissões granular por membro (hoje é fixa por role em
      `src/lib/permissions.ts`).
- [ ] Painel admin do sistema (visão de todas as organizações, logs,
      financeiro) — hoje não existe um "super-admin" separado.
- [ ] Log de atividade visível na UI (tabela `activity_log` já é
      populada pelas rotas, falta uma tela de auditoria).

## Fase 6 — Conteúdo e produtividade
- [ ] Brand book por cliente.
- [ ] Planejamento anual / campanhas com timeline.
- [ ] Módulo de tarefas internas (produtividade da equipe).
- [ ] Analytics de posts publicados (métricas via Upload-Post/Meta).

## Fase 7 — Integrações adicionais
- [ ] Blog (publicação em WordPress).
- [ ] Meta Ads (leitura/gestão de campanhas).
- [ ] Telegram como canal alternativo de aprovação/notificação.
- [ ] Webhooks de saída configuráveis (eventos → URL da agência).
- [ ] Importação de mídia do Google Drive.

## Fase 8 — Automação avançada
- [ ] API de agente (`/api/agent/*` com token) para operação
      programática — criar clientes, subir conteúdo, gerar link de
      aprovação, publicar, tudo via chamadas autenticadas por token.
- [ ] Módulo de descoberta e geração de conteúdo com IA (o "V4" do
      sistema de referência): raspagem de referências virais + geração de
      carrosséis/reels por frameworks, usando a API da Anthropic.

## Melhorias técnicas transversais
- [ ] Tipagem do banco via `supabase gen types` (hoje os tipos em
      `src/lib/types.ts` são mantidos manualmente em sincronia com o SQL).
- [ ] Testes automatizados (unitários nas rotas de API, E2E no fluxo de
      aprovação).
- [ ] Agendamento nativo da Upload-Post (`scheduled_date`) como
      alternativa ao cron próprio, se a confiabilidade for melhor.
