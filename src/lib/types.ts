// Tipos de domínio + shape mínimo do banco (mão, sem geração automática do
// Supabase CLI — ajuste caso rode `supabase gen types` no seu projeto).

export type UserRole = 'admin' | 'gestor' | 'designer' | 'cliente'
export type MemberStatus = 'active' | 'pending' | 'inactive'
export type ContentType = 'post' | 'carrossel' | 'reels' | 'story' | 'video'
export type ContentStatus =
  | 'ideia'
  | 'producao'
  | 'aprovacao_interna'
  | 'aprovacao_cliente'
  | 'agendado'
  | 'processando'
  | 'publicado'
export type ApprovalStatus = 'pendente' | 'aprovado' | 'ajuste'

export const CONTENT_STATUSES: { value: ContentStatus; label: string }[] = [
  { value: 'ideia', label: 'Ideia' },
  { value: 'producao', label: 'Produção' },
  { value: 'aprovacao_interna', label: 'Aprovação interna' },
  { value: 'aprovacao_cliente', label: 'Aprovação do cliente' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'publicado', label: 'Publicado' },
]

export const SOCIAL_PLATFORMS = [
  'instagram',
  'tiktok',
  'facebook',
  'youtube',
  'linkedin',
  'twitter',
] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: string
  brand_color: string
  upload_post_api_key: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_end: string | null
  created_at: string
  updated_at: string
}

/**
 * Capacidades controláveis por permissão, cobrindo as áreas mínimas do
 * produto (dashboard, clientes, conteúdo, mídia, aprovação, publicação,
 * equipe, configurações, integrações). `manageBilling` e `viewReports`
 * são reservadas para as Fases 3 e 6 — o flag já existe no modelo de
 * dados para essas fases não exigirem nova migration, mas hoje nenhuma
 * rota as consome ainda. "Administração" da organização corresponde a
 * `role === 'admin'` (ver `isOrgAdmin` em src/lib/permissions.ts) e não é
 * um flag independente — só um admin de organização deve poder alterar
 * `role`/`custom_permissions` de outros membros (evita escalonamento de
 * privilégio via permissão concedida).
 */
export interface RolePermissions {
  viewDashboard: boolean
  manageClients: boolean
  manageContent: boolean
  manageMedia: boolean
  approveInternal: boolean
  publish: boolean
  manageTeam: boolean
  manageSettings: boolean
  manageIntegrations: boolean
  manageBilling: boolean
  viewReports: boolean
}

export interface Member {
  id: string
  user_id: string
  org_id: string
  role: UserRole
  display_name: string
  avatar_url: string | null
  status: MemberStatus
  created_at: string
  /** Override parcial de RolePermissions. Null = usa o padrão do role. */
  custom_permissions: Partial<RolePermissions> | null
  email?: string
}

export interface Invite {
  id: string
  org_id: string
  email: string
  role: UserRole
  token: string
  invited_by: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface Client {
  id: string
  org_id: string
  name: string
  slug: string
  brand_primary_color: string | null
  brand_secondary_color: string | null
  logo_url: string | null
  contact: string | null
  notes: string | null
  created_at: string
}

/** Vínculo entre um membro (role='cliente') e o(s) cliente(s) que ele enxerga no Portal. */
export interface ClientMember {
  id: string
  member_id: string
  client_id: string
  created_at: string
}

/** Brand book — diretrizes de marca por cliente. */
export interface BrandAsset {
  id: string
  org_id: string
  client_id: string
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  fonts: string | null
  logo_url: string | null
  guidelines: string | null
  updated_at: string
  created_at: string
}

/** Acervo digital — pasta de mídia de um cliente, com opção de link público. */
export interface MediaFolder {
  id: string
  org_id: string
  client_id: string
  name: string
  public_token: string | null
  created_at: string
}

/** Arquivo dentro de uma pasta do acervo. */
export interface MediaFile {
  id: string
  org_id: string
  folder_id: string
  name: string
  url: string
  content_type: string | null
  size_bytes: number | null
  created_by: string | null
  created_at: string
}

export type CampaignStatus = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada'

/** Campanha — agrupa conteúdos de um cliente num período. */
export interface Campaign {
  id: string
  org_id: string
  client_id: string
  name: string
  description: string | null
  color: string | null
  start_date: string | null
  end_date: string | null
  status: CampaignStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Vínculo N:N entre campanha e conteúdo. */
export interface CampaignContentItem {
  id: string
  campaign_id: string
  content_item_id: string
  created_at: string
}

export type TaskStatus = 'pendente' | 'em_andamento' | 'concluida'

export interface TaskChecklistItem {
  id: string
  text: string
  done: boolean
}

/** Tarefa — dono, prazo, checklist e status. Pode estar ligada a um cliente/campanha/conteúdo. */
export interface Task {
  id: string
  org_id: string
  client_id: string | null
  campaign_id: string | null
  content_item_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  due_date: string | null
  assigned_to: string | null
  checklist: TaskChecklistItem[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TaskComment {
  id: string
  org_id: string
  task_id: string
  user_id: string | null
  body: string
  created_at: string
}

export interface ClientSocialProfile {
  id: string
  org_id: string
  client_id: string
  upload_post_username: string
  connected_platforms: { platform: SocialPlatform; username?: string; display_name?: string }[]
  last_synced_at: string | null
  created_at: string
}

export interface ContentItem {
  id: string
  org_id: string
  client_id: string
  title: string
  content_type: ContentType
  description: string | null
  caption: string | null
  media_urls: string[]
  cover_url: string | null
  channels: SocialPlatform[]
  status: ContentStatus
  scheduled_at: string | null
  published_at: string | null
  upload_post_job_id: string | null
  wordpress_post_url: string | null
  created_by: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  // Scheduler fields (migration 014)
  processing_started_at: string | null
  processing_run_id: string | null
  attempts: number
  last_error: string | null
  next_retry_at: string | null
  // joined
  client?: Client
  assignee?: Member
}

/** Credenciais do WordPress do cliente (Application Password — mecanismo oficial do WP). */
export interface ClientWordPressConfig {
  id: string
  org_id: string
  client_id: string
  site_url: string
  username: string
  connected_at: string
  created_at: string
}

/** Conexão OAuth do Google Drive da organização (🟣 dependência externa). */
export interface OrgGoogleDriveConfig {
  id: string
  org_id: string
  expires_at: string | null
  account_email: string | null
  connected_at: string
}

/** Conexão do Meta Ads da organização (🟣 dependência externa). */
export interface OrgMetaAdsConfig {
  id: string
  org_id: string
  ad_account_id: string
  connected_at: string
}

export type WebhookEventType =
  | 'content.created'
  | 'content.status_changed'
  | 'content.published'
  | 'approval.approved'
  | 'approval.changes_requested'

/** Webhook de saída — a organização cadastra a URL própria. */
export interface WebhookConfig {
  id: string
  org_id: string
  url: string
  events: WebhookEventType[]
  active: boolean
  created_by: string | null
  created_at: string
}

export type WebhookEventStatus = 'pending' | 'success' | 'failed'

export interface WebhookEvent {
  id: string
  org_id: string
  webhook_config_id: string
  event_type: string
  payload: Record<string, unknown>
  status: WebhookEventStatus
  attempts: number
  last_error: string | null
  next_attempt_at: string
  delivered_at: string | null
  created_at: string
}

/** Token de API de agente — por organização, hash guardado (nunca o token em texto puro). */
export interface OrgAgentToken {
  id: string
  org_id: string
  name: string
  token_prefix: string
  last_used_at: string | null
  created_at: string
}

/** Análise gerada pela IA sobre um material de referência colado manualmente. */
export interface ContentSourceAnalysis {
  summary: string
  angle_suggestions: string[]
  score: number
}

/** Material de referência colado manualmente (nunca raspado automaticamente — ver sql/011). */
export interface ContentSource {
  id: string
  org_id: string
  client_id: string
  title: string
  source_url: string | null
  raw_text: string
  analysis: ContentSourceAnalysis | null
  analyzed_at: string | null
  added_by: string | null
  created_at: string
}

/** Rascunho de conteúdo gerado pela IA — vira content_item real só quando aceito. */
export interface AiGenerationResult {
  title: string
  caption: string
  carousel_slides: { heading: string; body: string }[]
  suggested_channels: string[]
}

export interface AiGeneration {
  id: string
  org_id: string
  client_id: string
  campaign_id: string | null
  brief: string
  result: AiGenerationResult
  content_item_id: string | null
  created_by: string | null
  created_at: string
}

export interface ApprovalLink {
  id: string
  content_id: string
  org_id: string
  token: string
  status: ApprovalStatus
  reviewer_name: string | null
  comment: string | null
  created_at: string
  expires_at: string
  responded_at: string | null
  // joined
  content?: ContentItem
}

export interface InternalApproval {
  id: string
  org_id: string
  content_id: string
  status: ApprovalStatus
  requested_by: string | null
  reviewed_by: string | null
  comment: string | null
  created_at: string
  reviewed_at: string | null
  // joined
  requester?: Pick<Member, 'id' | 'display_name' | 'email'>
  reviewer?: Pick<Member, 'id' | 'display_name' | 'email'>
}

export interface Notification {
  id: string
  user_id: string
  org_id: string
  type: string
  title: string
  body: string | null
  read: boolean
  reference_id: string | null
  reference_type: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  org_id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}

// --------------------------------------------------------------------------
// Shape usado apenas para tipar o cliente Supabase (@supabase/ssr).
// Não é gerado automaticamente — mantenha em sincronia com sql/001_init.sql.
// --------------------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> }
      members: { Row: Member; Insert: Partial<Member>; Update: Partial<Member> }
      invites: { Row: Invite; Insert: Partial<Invite>; Update: Partial<Invite> }
      clients: { Row: Client; Insert: Partial<Client>; Update: Partial<Client> }
      client_social_profiles: {
        Row: ClientSocialProfile
        Insert: Partial<ClientSocialProfile>
        Update: Partial<ClientSocialProfile>
      }
      content_items: { Row: ContentItem; Insert: Partial<ContentItem>; Update: Partial<ContentItem> }
      approval_links: { Row: ApprovalLink; Insert: Partial<ApprovalLink>; Update: Partial<ApprovalLink> }
      internal_approvals: {
        Row: InternalApproval
        Insert: Partial<InternalApproval>
        Update: Partial<InternalApproval>
      }
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> }
      activity_log: { Row: ActivityLog; Insert: Partial<ActivityLog>; Update: Partial<ActivityLog> }
    }
  }
}
