/** Templates de e-mail transacional — HTML simples, sem dependência externa. */

function wrapper(title: string, body: string, ctaLabel?: string, ctaUrl?: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, sans-serif; background: #f7f7fb; padding: 24px;">
    <table width="100%" style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden;">
      <tr><td style="padding: 24px;">
        <p style="font-size: 14px; color: #6366F1; font-weight: 600; margin: 0 0 16px;">Posta AI</p>
        <h1 style="font-size: 18px; margin: 0 0 12px;">${title}</h1>
        <div style="font-size: 14px; color: #444; line-height: 1.5;">${body}</div>
        ${
          ctaLabel && ctaUrl
            ? `<a href="${ctaUrl}" style="display: inline-block; margin-top: 20px; background: #6366F1; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px;">${ctaLabel}</a>`
            : ''
        }
      </td></tr>
    </table>
  </body>
</html>`
}

export function inviteEmail(params: { orgName: string; role: string; link: string }) {
  return {
    subject: `Você foi convidado para ${params.orgName} — Posta AI`,
    html: wrapper(
      `Convite para ${params.orgName}`,
      `Você foi convidado como <strong>${params.role}</strong>. Clique no botão abaixo pra criar sua conta e entrar.`,
      'Aceitar convite',
      params.link,
    ),
  }
}

export function internalApprovalRequestedEmail(params: { contentTitle: string; link: string }) {
  return {
    subject: 'Conteúdo aguardando sua aprovação',
    html: wrapper('Aprovação interna pendente', `"<strong>${params.contentTitle}</strong>" está aguardando revisão.`, 'Revisar agora', params.link),
  }
}

export function internalApprovalDecidedEmail(params: { contentTitle: string; approved: boolean; comment?: string; link: string }) {
  return {
    subject: params.approved ? 'Seu conteúdo foi aprovado internamente' : 'Ajuste solicitado no seu conteúdo',
    html: wrapper(
      params.approved ? 'Conteúdo aprovado' : 'Ajuste solicitado',
      `"<strong>${params.contentTitle}</strong>"${params.comment ? `<br><br>Comentário: "${params.comment}"` : ''}`,
      'Ver conteúdo',
      params.link,
    ),
  }
}

export function externalApprovalDecidedEmail(params: { contentTitle: string; approved: boolean; comment?: string; link: string }) {
  return {
    subject: params.approved ? 'Cliente aprovou o conteúdo' : 'Cliente pediu ajuste no conteúdo',
    html: wrapper(
      params.approved ? 'Cliente aprovou' : 'Cliente pediu ajuste',
      `"<strong>${params.contentTitle}</strong>"${params.comment ? `<br><br>Comentário do cliente: "${params.comment}"` : ''}`,
      'Ver conteúdo',
      params.link,
    ),
  }
}

export function teamMemberJoinedEmail(params: { memberName: string; link: string }) {
  return {
    subject: 'Novo membro na equipe',
    html: wrapper('Novo membro', `<strong>${params.memberName}</strong> aceitou o convite e entrou na organização.`, 'Ver equipe', params.link),
  }
}

export function permissionsChangedEmail(params: { newRole?: string; link: string }) {
  return {
    subject: 'Suas permissões foram alteradas',
    html: wrapper(
      'Permissões alteradas',
      params.newRole ? `Seu papel agora é <strong>${params.newRole}</strong>.` : 'Suas permissões foram atualizadas por um admin.',
      'Ver organização',
      params.link,
    ),
  }
}
