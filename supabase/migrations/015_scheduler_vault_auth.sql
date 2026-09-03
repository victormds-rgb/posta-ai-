-- ============================================================================
--  Posta AI — Migration 015: Scheduler auth via Vault (secure, no secrets in cron)
--  Project ref: bmcqzptclnjhjgoocxpx (sa-east-1)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Pre-flight checks — fail fast if required extensions not enabled
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension not enabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension not enabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    RAISE EXCEPTION 'supabase_vault extension not enabled';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Verify scheduler_secret exists in Vault (manual step required before migration)
--    This DO block validates but does NOT create the secret.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = 'scheduler_secret';
  IF v_secret_id IS NULL THEN
    RAISE EXCEPTION 'Vault secret "scheduler_secret" not found. Create it manually before running this migration:
      INSERT INTO vault.secrets (secret, name, description)
      VALUES (''<SCHEDULER_SECRET_VALUE>'', ''scheduler_secret'', ''Secret for pg_cron -> Edge Functions auth'');
    ';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. SECURITY DEFINER function: reads secret from Vault, calls Edge Function
--    - Only allows the two known function slugs
--    - Uses fixed secret name 'scheduler_secret'
--    - Owner will be the role running this migration (typically postgres)
--    - SET search_path restricted to safe schemas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION scheduler_call_edge_function(
  p_function_slug text  -- Must be 'process-scheduled-posts' or 'retry-webhooks'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, vault, extensions
AS $$
DECLARE
  v_secret_id uuid;
  v_secret text;
  v_url text;
  v_response jsonb;
BEGIN
  -- Validate function slug before any Vault access or HTTP call
  IF p_function_slug NOT IN ('process-scheduled-posts', 'retry-webhooks') THEN
    RAISE EXCEPTION 'Invalid function_slug: %. Allowed: process-scheduled-posts, retry-webhooks', p_function_slug;
  END IF;

  -- Resolve secret_id by fixed name
  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = 'scheduler_secret';
  IF v_secret_id IS NULL THEN
    RAISE EXCEPTION 'Vault secret "scheduler_secret" not found';
  END IF;

  -- Read decrypted secret (only works for SECURITY DEFINER function owned by privileged role)
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Failed to decrypt vault secret "scheduler_secret"';
  END IF;

  -- Build Edge Function URL for project bmcqzptclnjhjgoocxpx
  v_url := 'https://bmcqzptclnjhjgoocxpx.supabase.co/functions/v1/' || p_function_slug;

  -- Call Edge Function with Authorization header (secret never leaves this function)
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO v_response;

  -- Return sanitized response (no secret, no full URL with auth header)
  RETURN jsonb_build_object(
    'request_id', v_response ->> 'request_id',
    'status', (v_response ->> 'status_code')::int,
    'ok', (v_response ->> 'status_code')::int BETWEEN 200 AND 299
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Permissions: revoke from PUBLIC, anon, authenticated; grant only to cron executor
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION scheduler_call_edge_function(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION scheduler_call_edge_function(text) FROM anon;
REVOKE EXECUTE ON FUNCTION scheduler_call_edge_function(text) FROM authenticated;

-- The role that executes cron jobs is typically 'postgres' in Supabase.
-- Verify current executor role:
--   SELECT cron.jobid, cron.jobname, cron.command FROM cron.job WHERE jobid IN (1, 2);
-- The function owner (definer) will be the role running this migration.
-- Grant EXECUTE to that same role (or the role shown above).
GRANT EXECUTE ON FUNCTION scheduler_call_edge_function(text) TO postgres;

-- ---------------------------------------------------------------------------
-- 4. Idempotent job management: remove ONLY known jobs, then create named ones
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_job1_exists boolean;
  v_job2_exists boolean;
  v_named1_exists boolean;
  v_named2_exists boolean;
BEGIN
  -- Check if named jobs already exist
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-posts') INTO v_named1_exists;
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-webhooks') INTO v_named2_exists;

  -- Check if the two current unnamed jobs (jobid 1, 2) are the expected ones
  SELECT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobid = 1
      AND schedule = '*/5 * * * *'
      AND command LIKE '%process-scheduled-posts%'
  ) INTO v_job1_exists;

  SELECT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobid = 2
    AND schedule = '*/10 * * * *'
    AND command LIKE '%retry-webhooks%'
  ) INTO v_job2_exists;

  -- Remove old unnamed jobs ONLY if they match expected signature
  IF v_job1_exists THEN
    PERFORM cron.unschedule(1);
  END IF;
  IF v_job2_exists THEN
    PERFORM cron.unschedule(2);
  END IF;

  -- Remove named jobs if they already exist (idempotent recreate)
  IF v_named1_exists THEN
    PERFORM cron.unschedule('process-scheduled-posts');
  END IF;
  IF v_named2_exists THEN
    PERFORM cron.unschedule('retry-webhooks');
  END IF;

  -- Create named jobs with secure function
  PERFORM cron.schedule(
    job_name := 'process-scheduled-posts',
    schedule := '*/5 * * * *',
    command := $cmd$SELECT scheduler_call_edge_function('process-scheduled-posts');$cmd$
  );

  PERFORM cron.schedule(
    job_name := 'retry-webhooks',
    schedule := '*/10 * * * *',
    command := $cmd$SELECT scheduler_call_edge_function('retry-webhooks');$cmd$
  );
END $$;

-- ---------------------------------------------------------------------------
-- 5. Post-migration verification (run after migration to confirm)
-- ---------------------------------------------------------------------------
-- SELECT
--   'pg_cron' AS check, extname, extversion FROM pg_extension WHERE extname = 'pg_cron'
-- UNION ALL SELECT 'pg_net', extname, extversion FROM pg_extension WHERE extname = 'pg_net'
-- UNION ALL SELECT 'supabase_vault', extname, extversion FROM pg_extension WHERE extname = 'supabase_vault';
--
-- SELECT name, id FROM vault.secrets WHERE name = 'scheduler_secret';
--
-- SELECT has_function_privilege('scheduler_call_edge_function(text)', 'EXECUTE') AS can_execute;
--
-- SELECT jobid, jobname, schedule, active, command
-- FROM cron.job
-- WHERE jobname IN ('process-scheduled-posts', 'retry-webhooks')
-- ORDER BY jobname;
--
-- Expected: 2 rows, jobname filled, active = true, command calls scheduler_call_edge_function

-- ---------------------------------------------------------------------------
-- 6. Rollback (manual, does NOT delete Vault secret)
-- ---------------------------------------------------------------------------
-- -- Step 1: Remove the two named jobs
-- SELECT cron.unschedule('process-scheduled-posts');
-- SELECT cron.unschedule('retry-webhooks');
--
-- -- Step 2: Drop the function
-- DROP FUNCTION IF EXISTS scheduler_call_edge_function(text);
--
-- -- Step 3: OPTIONAL - Only run manually if you want to delete the secret
-- -- DELETE FROM vault.secrets WHERE name = 'scheduler_secret';