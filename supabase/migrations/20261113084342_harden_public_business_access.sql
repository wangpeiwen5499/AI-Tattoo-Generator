-- Server-only application: Better Auth sessions are not Supabase Auth JWTs.
-- Preserve postgres/service_role; deny direct Data API access to business data.
SET LOCAL lock_timeout = '5s';
DO $security$
DECLARE
  obj record;
  function_name text;
BEGIN
  FOR obj IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname = ANY(ARRAY['account','ai_task','apikey','chat','chat_message','config','credit','guest_free_usage','order','permission','post','role','role_permission','session','studio_asset','studio_job','studio_record','subscription','tattoo_generation','tattoo_job','tattoo_project','taxonomy','user','user_role','verification'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',obj.relname);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',obj.relname);
  END LOOP;
  -- All existing public functions were inspected; none are extension-owned.
  FOREACH function_name IN ARRAY ARRAY['handle_updated_at()','deduct_credits(text,integer)','add_credits(text,integer)','claim_guest_free(text)']
  LOOP
    IF to_regprocedure('public.' || function_name) IS NOT NULL THEN
      EXECUTE 'REVOKE ALL PRIVILEGES ON FUNCTION public.' || function_name || ' FROM PUBLIC, anon, authenticated';
      EXECUTE 'ALTER FUNCTION public.' || function_name || ' SET search_path = pg_catalog, public';
    END IF;
  END LOOP;
END
$security$;
-- Scope table/sequence defaults to the business schema.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
-- PostgreSQL global default PUBLIC EXECUTE cannot be removed by a schema-local REVOKE.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
