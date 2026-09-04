-- Migration to add a webhook trigger for new clients
-- This will send a POST request to our marketmap-analytics python server

-- 1. Enable the pg_net extension if not already enabled (needed for http_post)
-- Note: In some Supabase setups, you configure webhooks via the UI rather than pg_net directly.
-- If pg_net is available, this function will trigger the external API.

-- Creating a generic function to call the webhook
CREATE OR REPLACE FUNCTION public.notify_new_client()
RETURNS trigger AS $$
DECLARE
  webhook_url text := 'http://host.docker.internal:8000/webhooks/supabase'; -- Update for production
  payload jsonb;
BEGIN
  -- Construct the payload to match what our FastAPI server expects
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', null
  );

  -- Perform the HTTP POST request (Requires pg_net extension)
  -- For local dev without pg_net, you might need to use the Supabase Dashboard -> Database -> Webhooks
  -- If pg_net is installed, uncomment the following line:
  -- PERFORM net.http_post(webhook_url, payload, '{"Content-Type": "application/json"}'::jsonb);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger on the clients table
DROP TRIGGER IF EXISTS trigger_notify_new_client ON public.clients;

CREATE TRIGGER trigger_notify_new_client
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_client();
