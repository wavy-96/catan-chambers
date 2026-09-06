BEGIN;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS scoring_rules jsonb;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS contributions integer[];
CREATE OR REPLACE FUNCTION public.create_chambers_season_v3(p_request_id uuid,p_name text,p_total_games integer,p_prize_pool integer,p_tie text,p_scoring_rules jsonb,p_contributions integer[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing tournaments%ROWTYPE; r jsonb; road integer:=0; army integer:=0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('chambers-season-create'));
  IF p_request_id IS NULL OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 60 OR p_total_games IS NULL OR p_total_games NOT BETWEEN 1 AND 100 OR p_prize_pool IS DISTINCT FROM 12000 OR p_contributions IS DISTINCT FROM ARRAY[0,2000,4000,6000] OR p_tie IS NULL OR p_tie NOT IN ('each','split','none') THEN RAISE EXCEPTION 'Invalid season details or contribution plan.'; END IF;
  IF p_scoring_rules IS NULL OR jsonb_typeof(p_scoring_rules)<>'array' THEN RAISE EXCEPTION 'Choose recorded stats for scoring rules.'; END IF;
  IF jsonb_array_length(p_scoring_rules)>5 THEN RAISE EXCEPTION 'Too many scoring rules.'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_scoring_rules) LOOP
    IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR r->>'metric' IS NULL OR r->>'metric' NOT IN ('roads','armies','wins','points','bestStreak') OR jsonb_typeof(r->'points') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Unknown scoring rule.'; END IF;
    IF (r->>'points')::numeric<>trunc((r->>'points')::numeric) OR (r->>'points')::numeric NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid bonus points.'; END IF;
    IF r->>'metric'='roads' THEN road:=(r->>'points')::integer; END IF;
    IF r->>'metric'='armies' THEN army:=(r->>'points')::integer; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'metric') FROM jsonb_array_elements(p_scoring_rules))<>jsonb_array_length(p_scoring_rules) THEN RAISE EXCEPTION 'Choose each stat only once.'; END IF;
  SELECT * INTO existing FROM tournaments WHERE id=p_request_id;
  IF FOUND THEN
    IF existing.name IS DISTINCT FROM trim(p_name) OR existing.total_games IS DISTINCT FROM p_total_games OR existing.prize_pool IS DISTINCT FROM p_prize_pool OR existing.bonus_tie_rule IS DISTINCT FROM p_tie OR existing.scoring_rules IS DISTINCT FROM p_scoring_rules OR existing.contributions IS DISTINCT FROM p_contributions THEN RAISE EXCEPTION 'This request was already used for a different season.'; END IF;
    RETURN existing.id;
  END IF;
  IF EXISTS(SELECT 1 FROM tournaments WHERE status='active') THEN RAISE EXCEPTION 'Finish the active season first.'; END IF;
  IF EXISTS(SELECT 1 FROM tournaments WHERE lower(name)=lower(trim(p_name))) THEN RAISE EXCEPTION 'A season with that name exists.'; END IF;
  INSERT INTO tournaments(id,name,total_games,prize_pool,status,road_bonus,army_bonus,bonus_tie_rule,scoring_rules,contributions)
    VALUES(p_request_id,trim(p_name),p_total_games,p_prize_pool,'active',road,army,p_tie,p_scoring_rules,p_contributions);
  PERFORM rebuild_chambers_stats();
  INSERT INTO chambers_audit(action,detail) VALUES('season_created',p_request_id::text);
  RETURN p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.create_chambers_season_v3(uuid,text,integer,integer,text,jsonb,integer[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_chambers_season_v3(uuid,text,integer,integer,text,jsonb,integer[]) TO service_role;
-- Existing seasons keep their original pool and scoring. New settings apply on creation.
COMMIT;
NOTIFY pgrst,'reload schema';
