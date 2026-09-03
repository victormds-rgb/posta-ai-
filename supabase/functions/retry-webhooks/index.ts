import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SCHEDULER_SECRET = Deno.env.get("SCHEDULER_SECRET")!
const CREDENTIALS_ENCRYPTION_KEY = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// Web Crypto API implementation of AES-256-GCM decryption
// Matches the Node.js crypto.ts encryptSecret/decryptSecret format: "iv.tag.data" (all base64)
async function decryptSecret(ciphertext: string): Promise<string> {
  if (!CREDENTIALS_ENCRYPTION_KEY) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY não configurada no Edge Function")
  }

  const [ivB64, tagB64, dataB64] = ciphertext.split(".")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de segredo cifrado inválido.")
  }

  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const tag = Uint8Array.from(atob(tagB64), (c) => c.charCodeAt(0))
  const data = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0))

  // Combine data + tag for Web Crypto (it expects the auth tag appended to ciphertext)
  const ciphertextWithTag = new Uint8Array(data.length + tag.length)
  ciphertextWithTag.set(data)
  ciphertextWithTag.set(tag, data.length)

  const key = await crypto.subtle.importKey(
    "raw",
    hexToUint8Array(CREDENTIALS_ENCRYPTION_KEY),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertextWithTag
  )

  return new TextDecoder().decode(decrypted)
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

const MAX_ATTEMPTS = 5
const TIMEOUT_MS = 10_000

async function signWebhookPayload(secret: string, rawBody: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function assertPublicUrl(url: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return { ok: false, reason: "apenas HTTPS permitido" }

    const hostname = parsed.hostname
    const blockedPatterns = [
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/,
      /^localhost$/i,
      /\.local$/i,
    ]
    for (const pattern of blockedPatterns) {
      if (pattern.test(hostname)) return { ok: false, reason: "URL privada/bloqueada (SSRF)" }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: "URL inválida" }
  }
}

async function deliver(
  url: string,
  secret: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const urlCheck = await assertPublicUrl(url)
  if (!urlCheck.ok) return { ok: false, error: urlCheck.reason }

  const body = JSON.stringify({
    event: eventType,
    data: payload,
    sent_at: new Date().toISOString(),
  })
  const signature = await signWebhookPayload(secret, body)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Posta-Event": eventType,
        "X-Posta-Signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha de rede" }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // Timing-safe auth check
  const auth = req.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const token = auth.slice(7)
  if (!timingSafeEqual(token, SCHEDULER_SECRET)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    // Claim due webhook events atomically
    const claimId = `${crypto.randomUUID()}-${Date.now()}`
    const { data: claimedEvents, error: claimError } = await supabase.rpc("claim_due_webhook_events", {
      p_batch_size: 50,
      p_claim_id: claimId,
    })

    if (claimError) {
      console.error("claim_due_webhook_events error:", claimError)
      return new Response(JSON.stringify({ error: "claim_failed", details: claimError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let succeeded = 0

    for (const event of claimedEvents ?? []) {
      // Fetch webhook config
      const { data: config } = await supabase
        .from("webhook_configs")
        .select("*")
        .eq("id", event.webhook_config_id)
        .maybeSingle()

      if (!config || !config.active) {
        await supabase.rpc("complete_webhook_event", {
          p_event_id: event.id,
          p_claim_id: claimId,
          p_success: false,
          p_error: "webhook desativado",
        })
        continue
      }

      // Decrypt the secret
      let secret: string
      try {
        secret = await decryptSecret(config.secret)
      } catch (err) {
        await supabase.rpc("complete_webhook_event", {
          p_event_id: event.id,
          p_claim_id: claimId,
          p_success: false,
          p_error: "falha ao decifrar segredo do webhook",
        })
        continue
      }

      const result = await deliver(config.url, secret, event.event_type, event.payload as Record<string, unknown>)

      const success = await supabase.rpc("complete_webhook_event", {
        p_event_id: event.id,
        p_claim_id: claimId,
        p_success: result.ok,
        p_error: result.error,
      })

      if (success.data === true && result.ok) {
        succeeded++
      }
    }

    return new Response(JSON.stringify({ retried: (claimedEvents ?? []).length, succeeded }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("retry-webhooks error:", err)
    return new Response(JSON.stringify({ error: "internal_error", details: err instanceof Error ? err.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})