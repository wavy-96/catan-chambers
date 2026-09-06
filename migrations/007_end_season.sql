BEGIN;
CREATE OR REPLACE FUNCTION public.end_chambers_season(p_season_id uuid,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tournaments%ROWTYPE; played integer; final_note text;
BEGIN
  IF p_season_id IS NULL OR p_note IS NULL OR length(p_note)>300 THEN RAISE EXCEPTION 'Invalid season or note.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('chambers-season-create'));
  PERFORM pg_advisory_xact_lock(hashtext(p_season_id::text));
  SELECT * INTO t FROM tournaments WHERE id=p_season_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found.'; END IF;
  IF t.status='completed' THEN RETURN; END IF;
  IF t.status<>'active' THEN RAISE EXCEPTION 'This season is not active.'; END IF;
  SELECT count(*) INTO played FROM games WHERE tournament_id=t.id AND voided_at IS NULL;
  final_note:=nullif(trim(p_note),'');
  IF final_note IS NULL AND played<t.total_games THEN final_note:=format('Season ended after %s games.',played); END IF;
  UPDATE tournaments SET status='completed',completion_note=final_note WHERE id=t.id;
  INSERT INTO chambers_audit(action,detail) VALUES('season_ended',jsonb_build_object('season_id',t.id,'games',played,'note',final_note)::text);
END $$;
REVOKE ALL ON FUNCTION public.end_chambers_season(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.end_chambers_season(uuid,text) TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
