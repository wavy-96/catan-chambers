BEGIN;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS house_rules text[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION public.create_chambers_season_v2(p_request_id uuid,p_name text,p_total_games integer,p_prize_pool integer,p_tie text,p_road integer,p_army integer,p_house_rules text[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing tournaments%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('chambers-season-create'));
  IF p_request_id IS NULL OR p_name IS NULL OR p_total_games IS NULL OR p_prize_pool IS NULL OR p_tie IS NULL OR p_road IS NULL OR p_army IS NULL OR p_house_rules IS NULL
    OR length(trim(p_name)) NOT BETWEEN 1 AND 60 OR p_total_games NOT BETWEEN 1 AND 100 OR p_prize_pool NOT BETWEEN 0 AND 1000000
    OR p_tie NOT IN ('each','split','none') OR p_road NOT BETWEEN 0 AND 100 OR p_army NOT BETWEEN 0 AND 100
    OR cardinality(p_house_rules)>10 OR EXISTS(SELECT 1 FROM unnest(p_house_rules) r WHERE r IS NULL OR length(trim(r)) NOT BETWEEN 1 AND 300)
    THEN RAISE EXCEPTION 'Invalid season rules.'; END IF;
  SELECT coalesce(array_agg(trim(r)),'{}') INTO p_house_rules FROM unnest(p_house_rules) r;
  SELECT * INTO existing FROM tournaments WHERE id=p_request_id;
  IF FOUND THEN
    IF existing.name IS DISTINCT FROM trim(p_name) OR existing.total_games IS DISTINCT FROM p_total_games OR existing.prize_pool IS DISTINCT FROM p_prize_pool OR existing.bonus_tie_rule IS DISTINCT FROM p_tie OR existing.road_bonus IS DISTINCT FROM p_road OR existing.army_bonus IS DISTINCT FROM p_army OR existing.house_rules IS DISTINCT FROM p_house_rules THEN RAISE EXCEPTION 'This request was already used for a different season.'; END IF;
    RETURN existing.id;
  END IF;
  IF EXISTS(SELECT 1 FROM tournaments WHERE status='active') THEN RAISE EXCEPTION 'Finish the active season first.'; END IF;
  IF EXISTS(SELECT 1 FROM tournaments WHERE lower(name)=lower(trim(p_name))) THEN RAISE EXCEPTION 'A season with that name exists.'; END IF;
  INSERT INTO tournaments(id,name,total_games,prize_pool,status,road_bonus,army_bonus,bonus_tie_rule,house_rules)
    VALUES(p_request_id,trim(p_name),p_total_games,p_prize_pool,'active',p_road,p_army,p_tie,p_house_rules);
  PERFORM rebuild_chambers_stats();
  INSERT INTO chambers_audit(action,detail) VALUES('season_created',p_request_id::text);
  RETURN p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.create_chambers_season_v2(uuid,text,integer,integer,text,integer,integer,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_chambers_season_v2(uuid,text,integer,integer,text,integer,integer,text[]) TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
