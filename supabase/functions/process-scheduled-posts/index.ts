import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SCHEDULER_SECRET = Deno.env.get("SCHEDULER_SECRET");
const UPLOAD_POST_API_URL = Deno.env.get("UPLOAD_POST_API_URL") || "https://api.upload-post.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for(let i = 0; i < a.length; i++){
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
async function publishPost(apiKey, params) {
  const isVideo = params.media_urls.some((u)=>/\.(mp4|mov|webm)$/i.test(u));
  const endpoint = isVideo ? "/api/upload_videos" : "/api/upload_photos";
  try {
    const res = await fetch(`${UPLOAD_POST_API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user: params.username,
        platform: params.platforms,
        title: params.title || params.caption.slice(0, 80),
        caption: params.caption,
        photos: isVideo ? undefined : params.media_urls,
        video: isVideo ? params.media_urls[0] : undefined,
        scheduled_date: params.scheduled_date
      }),
      signal: AbortSignal.timeout(15_000)
    });
    const json = await res.json().catch(()=>({}));
    if (!res.ok) {
      return {
        success: false,
        error: json?.message || `HTTP ${res.status}`
      };
    }
    return {
      success: true,
      data: json
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Falha de rede"
    };
  }
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  // Timing-safe auth check
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({
      error: "unauthorized"
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  const token = auth.slice(7);
  if (!timingSafeEqual(token, SCHEDULER_SECRET)) {
    return new Response(JSON.stringify({
      error: "unauthorized"
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  try {
    // Claim due items atomically
    const { data: claimedItems, error: claimError } = await supabase.rpc("claim_due_content_items", {
      p_batch_size: 20,
      p_run_id: crypto.randomUUID()
    });
    if (claimError) {
      console.error("claim_due_content_items error:", claimError);
      return new Response(JSON.stringify({
        error: "claim_failed",
        details: claimError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const results = [];
    for (const item of claimedItems ?? []){
      // Fetch org to get Upload-Post API key
      const { data: org } = await supabase.from("organizations").select("upload_post_api_key").eq("id", item.org_id).maybeSingle();
      const apiKey = org?.upload_post_api_key;
      if (!apiKey) {
        await supabase.rpc("complete_content_item", {
          p_item_id: item.id,
          p_run_id: item.processing_run_id,
          p_success: false,
          p_error: "sem chave Upload-Post configurada"
        });
        results.push({
          id: item.id,
          ok: false,
          error: "sem chave Upload-Post configurada"
        });
        continue;
      }
      // Fetch client social profile
      const { data: profile } = await supabase.from("client_social_profiles").select("upload_post_username, connected_platforms").eq("client_id", item.client_id).maybeSingle();
      if (!profile || !item.media_urls?.length || !item.channels?.length) {
        await supabase.rpc("complete_content_item", {
          p_item_id: item.id,
          p_run_id: item.processing_run_id,
          p_success: false,
          p_error: "faltam mídia, canais ou redes conectadas"
        });
        results.push({
          id: item.id,
          ok: false,
          error: "faltam mídia, canais ou redes conectadas"
        });
        continue;
      }
      // Check if content is publishable (no pending approvals)
      const { data: internalApproval } = await supabase.from("internal_approvals").select("status").eq("content_id", item.id).in("status", [
        "pendente",
        "ajuste"
      ]).maybeSingle();
      if (internalApproval) {
        await supabase.rpc("complete_content_item", {
          p_item_id: item.id,
          p_run_id: item.processing_run_id,
          p_success: false,
          p_error: "aprovação interna pendente"
        });
        results.push({
          id: item.id,
          ok: false,
          error: "aprovação interna pendente"
        });
        continue;
      }
      const { data: approvalLink } = await supabase.from("approval_links").select("status, expires_at").eq("content_id", item.id).eq("status", "pendente").gt("expires_at", new Date().toISOString()).maybeSingle();
      if (approvalLink) {
        await supabase.rpc("complete_content_item", {
          p_item_id: item.id,
          p_run_id: item.processing_run_id,
          p_success: false,
          p_error: "aprovação do cliente pendente"
        });
        results.push({
          id: item.id,
          ok: false,
          error: "aprovação do cliente pendente"
        });
        continue;
      }
      // Publish to Upload-Post
      const publishResult = await publishPost(apiKey, {
        username: profile.upload_post_username,
        platforms: item.channels,
        title: item.title,
        caption: item.caption || "",
        media_urls: item.media_urls
      });
      if (!publishResult.success) {
        await supabase.rpc("complete_content_item", {
          p_item_id: item.id,
          p_run_id: item.processing_run_id,
          p_success: false,
          p_error: publishResult.error
        });
        results.push({
          id: item.id,
          ok: false,
          error: publishResult.error
        });
        continue;
      }
      // Success: mark as publicado
      await supabase.rpc("complete_content_item", {
        p_item_id: item.id,
        p_run_id: item.processing_run_id,
        p_success: true,
        p_upload_post_job_id: publishResult.data?.job_id || null
      });
      // Dispatch webhook event via RPC (fire-and-forget)
      supabase.rpc("dispatch_webhook_event", {
        p_org_id: item.org_id,
        p_event_type: "content.published",
        p_payload: {
          content_id: item.id,
          title: item.title
        }
      }).catch((err)=>console.error("dispatch_webhook_event failed:", err));
      results.push({
        id: item.id,
        ok: true
      });
    }
    return new Response(JSON.stringify({
      processed: results.length,
      results
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("process-scheduled-posts error:", err);
    return new Response(JSON.stringify({
      error: "internal_error",
      details: err instanceof Error ? err.message : "unknown"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
