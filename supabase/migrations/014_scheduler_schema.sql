-- ============================================================================
--  Posta AI — Migration 014: Scheduler schema (concurrency-safe processing)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add 'processando' status to content_items status check constraint
-- ---------------------------------------------------------------------------
-- First, drop the existing check constraint
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_status_check;

-- Recreate with the new status 'processando' preserving existing statuses
ALTER TABLE content_items ADD CONSTRAINT content_items_status_check
  CHECK (status IN ('ideia', 'producao', 'aprovacao_interna', 'aprovacao_cliente', 'agendado', 'processando', 'publicado'));

-- ---------------------------------------------------------------------------
-- 2. Add concurrency/processing columns to content_items (only if missing)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- processing_started_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'processing_started_at') THEN
    ALTER TABLE content_items ADD COLUMN processing_started_at timestamptz;
  END IF;

  -- processing_run_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'processing_run_id') THEN
    ALTER TABLE content_items ADD COLUMN processing_run_id uuid;
  END IF;

  -- attempts (for retry logic)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'attempts') THEN
    ALTER TABLE content_items ADD COLUMN attempts integer NOT NULL DEFAULT 0;
  END IF;

  -- last_error
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'last_error') THEN
    ALTER TABLE content_items ADD COLUMN last_error text;
  END IF;

  -- next_retry_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'next_retry_at') THEN
    ALTER TABLE content_items ADD COLUMN next_retry_at timestamptz;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Add indexes for scheduler queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_content_items_processing
  ON content_items(status, processing_started_at)
  WHERE status = 'processando';

CREATE INDEX IF NOT EXISTS idx_content_items_retry
  ON content_items(status, next_retry_at)
  WHERE status = 'processando' AND next_retry_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Improve webhook_events for concurrency-safe retry
--    (claim events atomically before delivery, track claimed_by/run_id)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- claimed_by (Edge Function instance identifier)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_events' AND column_name = 'claimed_by') THEN
    ALTER TABLE webhook_events ADD COLUMN claimed_by text;
  END IF;

  -- claimed_at (when the claim was made, for stale claim detection)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_events' AND column_name = 'claimed_at') THEN
    ALTER TABLE webhook_events ADD COLUMN claimed_at timestamptz;
  END IF;

  -- run_id (correlation ID for this processing run)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_events' AND column_name = 'run_id') THEN
    ALTER TABLE webhook_events ADD COLUMN run_id uuid;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Indexes for webhook_events concurrency-safe queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry
  ON webhook_events(status, next_attempt_at)
  WHERE status IN ('pending', 'failed') AND next_attempt_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_events_claimed
  ON webhook_events(claimed_by, claimed_at)
  WHERE claimed_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. RPC: claim_due_content_items
--    Atomically claims up to N 'agendado' items that are due, marking them 'processando'
--    Returns the claimed items for processing outside of transaction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_due_content_items(
  p_batch_size integer DEFAULT 20,
  p_run_id uuid DEFAULT gen_random_uuid(),
  p_stale_threshold interval DEFAULT interval '10 minutes'
)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  client_id uuid,
  title varchar,
  content_type varchar,
  description text,
  caption text,
  media_urls jsonb,
  cover_url text,
  channels jsonb,
  scheduled_at timestamptz,
  upload_post_job_id text,
  created_by uuid,
  assigned_to uuid,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- First, recover stale 'processando' items (abandoned by crashed runners)
  UPDATE content_items
  SET status = 'agendado',
      processing_started_at = NULL,
      processing_run_id = NULL,
      attempts = 0,
      last_error = NULL,
      next_retry_at = NULL
  WHERE status = 'processando'
    AND processing_started_at IS NOT NULL
    AND processing_started_at < v_now - p_stale_threshold;

  -- Atomically claim due 'agendado' items
  RETURN QUERY
  UPDATE content_items
  SET status = 'processando',
      processing_started_at = v_now,
      processing_run_id = p_run_id,
      attempts = attempts + 1,
      updated_at = v_now
  WHERE id IN (
    SELECT id FROM content_items
    WHERE status = 'agendado'
      AND scheduled_at <= v_now
    ORDER BY scheduled_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    id, org_id, client_id, title, content_type, description, caption,
    media_urls, cover_url, channels, scheduled_at, upload_post_job_id,
    created_by, assigned_to, created_at, updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 7. RPC: complete_content_item
--    Marks a content_item as 'publicado' or back to 'agendado' with retry scheduling
--    Only succeeds if processing_run_id matches (prevents double-processing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_content_item(
  p_item_id uuid,
  p_run_id uuid,
  p_success boolean,
  p_upload_post_job_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_item content_items%ROWTYPE;
  v_next_retry timestamptz;
BEGIN
  -- Fetch current state
  SELECT * INTO v_item
  FROM content_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Verify run_id matches (concurrency guard)
  IF v_item.processing_run_id IS DISTINCT FROM p_run_id THEN
    RETURN false;
  END IF;

  -- Never reprocess published items
  IF v_item.status = 'publicado' THEN
    RETURN false;
  END IF;

  IF p_success THEN
    -- Success: mark as publicado
    UPDATE content_items
    SET status = 'publicado',
        published_at = now(),
        upload_post_job_id = p_upload_post_job_id,
        processing_started_at = NULL,
        processing_run_id = NULL,
        last_error = NULL,
        next_retry_at = NULL,
        updated_at = now()
    WHERE id = p_item_id;
    RETURN true;
  ELSE
    -- Failure: schedule retry with exponential backoff
    -- Backoff: 1min, 5min, 30min, 2h, 6h (max 5 attempts total)
    CASE v_item.attempts
      WHEN 1 THEN v_next_retry := now() + interval '1 minute';
      WHEN 2 THEN v_next_retry := now() + interval '5 minutes';
      WHEN 3 THEN v_next_retry := now() + interval '30 minutes';
      WHEN 4 THEN v_next_retry := now() + interval '2 hours';
      ELSE v_next_retry := now() + interval '6 hours';
    END CASE;

    IF v_item.attempts >= 5 THEN
      -- Max attempts reached: keep as 'processando' with error, no next_retry
      UPDATE content_items
      SET status = 'processando',
          last_error = p_error,
          next_retry_at = NULL,
          updated_at = now()
      WHERE id = p_item_id;
    ELSE
      -- Schedule retry: back to 'agendado' with next_retry_at
      UPDATE content_items
      SET status = 'agendado',
          scheduled_at = v_next_retry,
          processing_started_at = NULL,
          processing_run_id = NULL,
          last_error = p_error,
          next_retry_at = v_next_retry,
          updated_at = now()
      WHERE id = p_item_id;
    END IF;
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 8. RPC: claim_due_webhook_events
--    Atomically claims pending/failed webhook_events due for retry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_due_webhook_events(
  p_batch_size integer DEFAULT 50,
  p_claim_id text DEFAULT (gen_random_uuid() || '-' || floor(EXTRACT(EPOCH FROM now()))::text),
  p_stale_threshold interval DEFAULT interval '5 minutes'
)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  webhook_config_id uuid,
  event_type text,
  payload jsonb,
  attempts integer,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz
) AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- First, recover stale claimed events (abandoned by crashed runners)
  UPDATE webhook_events
  SET status = 'pending',
      claimed_by = NULL,
      claimed_at = NULL,
      run_id = NULL
  WHERE status IN ('pending', 'failed')
    AND claimed_by IS NOT NULL
    AND claimed_at < v_now - p_stale_threshold;

  -- Atomically claim due events
  RETURN QUERY
  UPDATE webhook_events
  SET status = 'pending',
      claimed_by = p_claim_id,
      claimed_at = v_now,
      run_id = gen_random_uuid()
  WHERE id IN (
    SELECT id FROM webhook_events
    WHERE status IN ('pending', 'failed')
      AND next_attempt_at <= v_now
      AND attempts < 5
      AND (claimed_by IS NULL OR claimed_at < v_now - p_stale_threshold)
    ORDER BY next_attempt_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    id, org_id, webhook_config_id, event_type, payload, attempts,
    last_error, next_attempt_at, created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 9. RPC: complete_webhook_event
--    Marks a webhook_event as success or failed with backoff
--    Only succeeds if claimed_by matches (prevents double-processing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_webhook_event(
  p_event_id uuid,
  p_claim_id text,
  p_success boolean,
  p_error text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_event webhook_events%ROWTYPE;
  v_next_attempt timestamptz;
BEGIN
  SELECT * INTO v_event
  FROM webhook_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Verify claim_id matches
  IF v_event.claimed_by IS DISTINCT FROM p_claim_id THEN
    RETURN false;
  END IF;

  -- Never retry delivered webhooks
  IF v_event.status = 'success' THEN
    RETURN false;
  END IF;

  IF p_success THEN
    UPDATE webhook_events
    SET status = 'success',
        delivered_at = now(),
        claimed_by = NULL,
        claimed_at = NULL,
        run_id = NULL,
        updated_at = now()
    WHERE id = p_event_id;
    RETURN true;
  ELSE
    -- Exponential backoff: 1min, 5min, 30min, 2h, 6h
    CASE v_event.attempts + 1
      WHEN 1 THEN v_next_attempt := now() + interval '1 minute';
      WHEN 2 THEN v_next_attempt := now() + interval '5 minutes';
      WHEN 3 THEN v_next_attempt := now() + interval '30 minutes';
      WHEN 4 THEN v_next_attempt := now() + interval '2 hours';
      ELSE v_next_attempt := now() + interval '6 hours';
    END CASE;

    IF v_event.attempts + 1 >= 5 THEN
      -- Max attempts: mark failed permanently
      UPDATE webhook_events
      SET status = 'failed',
          attempts = v_event.attempts + 1,
          last_error = p_error,
          next_attempt_at = NULL,
          claimed_by = NULL,
          claimed_at = NULL,
          run_id = NULL,
          updated_at = now()
      WHERE id = p_event_id;
    ELSE
      -- Schedule retry
      UPDATE webhook_events
      SET status = 'pending',
          attempts = v_event.attempts + 1,
          last_error = p_error,
          next_attempt_at = v_next_attempt,
          claimed_by = NULL,
          claimed_at = NULL,
          run_id = NULL,
          updated_at = now()
      WHERE id = p_event_id;
    END IF;
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 10. RPC: dispatch_webhook_event
--     Dispatches webhook event to all subscribed configs (async, fire-and-forget)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dispatch_webhook_event(
  p_org_id uuid,
  p_event_type text,
  p_payload jsonb
)
RETURNS void AS $$
DECLARE
  v_config RECORD;
  v_secret text;
  v_event_id uuid;
BEGIN
  FOR v_config IN
    SELECT * FROM webhook_configs
    WHERE org_id = p_org_id
      AND active = true
      AND p_event_type = ANY(events)
  LOOP
    -- Decrypt secret
    -- Note: In production, this should be done in application layer
    -- For now, we'll insert the event and let the retry-webhooks function handle delivery
    INSERT INTO webhook_events (org_id, webhook_config_id, event_type, payload, status, attempts, next_attempt_at)
    VALUES (p_org_id, v_config.id, p_event_type, p_payload, 'pending', 1, now())
    RETURNING id INTO v_event_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 11. Grant execute permissions to authenticated role
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION claim_due_content_items TO authenticated;
GRANT EXECUTE ON FUNCTION complete_content_item TO authenticated;
GRANT EXECUTE ON FUNCTION claim_due_webhook_events TO authenticated;
GRANT EXECUTE ON FUNCTION complete_webhook_event TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_webhook_event TO authenticated;

-- ---------------------------------------------------------------------------
-- 12. Record this migration
-- ---------------------------------------------------------------------------
INSERT INTO schema_migrations (version, applied_at)
VALUES ('014', now())
ON CONFLICT (version) DO NOTHING;