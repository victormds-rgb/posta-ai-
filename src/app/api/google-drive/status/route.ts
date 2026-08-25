import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { isGoogleDriveConfigured } from '@/lib/google-drive'
import type { OrgGoogleDriveConfig } from '@/lib/types'

export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('org_google_drive_config')
    .select('id, org_id, expires_at, account_email, connected_at')
    .eq('org_id', ctx.organization.id)
    .maybeSingle()

  if (error) return serverError(error, 'google-drive.status')
  return NextResponse.json({
    configured: isGoogleDriveConfigured(),
    config: (data ?? null) as OrgGoogleDriveConfig | null,
  })
}

export async function DELETE() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.from('org_google_drive_config').delete().eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'google-drive.disconnect')
  return NextResponse.json({ success: true })
}
