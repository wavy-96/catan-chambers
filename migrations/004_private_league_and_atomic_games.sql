-- Run as project owner after deploying the server-authenticated app.
BEGIN;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS road_bonus integer NOT NULL DEFAULT 0;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS army_bonus integer NOT NULL DEFAULT 0;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS bonus_tie_rule text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS completion_note text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar_url text;
CREATE UNIQUE INDEX IF NOT EXISTS chambers_game_number ON public.games(tournament_id,game_number);
CREATE UNIQUE INDEX IF NOT EXISTS chambers_game_player ON public.game_scores(game_id,player_id);
CREATE TABLE IF NOT EXISTS public.chambers_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),game_id uuid REFERENCES public.games(id),action text NOT NULL,detail text,created_at timestamptz NOT NULL DEFAULT now());
DO $$ DECLARE t text; p record; BEGIN
  FOREACH t IN ARRAY ARRAY['tournaments','players','games','game_scores','player_stats','tournament_player_stats','chambers_audit'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.rebuild_chambers_stats() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record; t record; g record; streak integer; best integer;
BEGIN
  FOR t IN SELECT id FROM tournaments LOOP
    FOR p IN SELECT id FROM players LOOP
      streak:=0; best:=0;
      FOR g IN SELECT winner_id FROM games WHERE tournament_id=t.id AND voided_at IS NULL ORDER BY game_number LOOP
        IF g.winner_id=p.id THEN streak:=streak+1; ELSE streak:=0; END IF; best:=GREATEST(best,streak);
      END LOOP;
      INSERT INTO tournament_player_stats(tournament_id,player_id,total_games,wins,total_points,longest_road_count,largest_army_count,win_streak,best_win_streak)
      SELECT t.id,p.id,count(gs.id),count(gs.id) FILTER(WHERE gm.winner_id=p.id),coalesce(sum(gs.points),0),count(gs.id) FILTER(WHERE gs.longest_road),count(gs.id) FILTER(WHERE gs.largest_army),streak,best
      FROM game_scores gs JOIN games gm ON gm.id=gs.game_id WHERE gs.player_id=p.id AND gm.tournament_id=t.id AND gm.voided_at IS NULL
      ON CONFLICT(tournament_id,player_id) DO UPDATE SET total_games=excluded.total_games,wins=excluded.wins,total_points=excluded.total_points,longest_road_count=excluded.longest_road_count,largest_army_count=excluded.largest_army_count,win_streak=excluded.win_streak,best_win_streak=excluded.best_win_streak,updated_at=now();
    END LOOP;
  END LOOP;
  FOR p IN SELECT id FROM players LOOP
    streak:=0; best:=0;
    FOR g IN SELECT winner_id FROM games WHERE voided_at IS NULL ORDER BY date,created_at,game_number LOOP
      IF g.winner_id=p.id THEN streak:=streak+1; ELSE streak:=0; END IF; best:=GREATEST(best,streak);
    END LOOP;
    UPDATE player_stats SET
      total_games=(SELECT count(*) FROM game_scores gs JOIN games gm ON gm.id=gs.game_id WHERE gs.player_id=p.id AND gm.voided_at IS NULL),
      wins=(SELECT count(*) FROM games WHERE winner_id=p.id AND voided_at IS NULL),
      total_points=(SELECT coalesce(sum(gs.points),0) FROM game_scores gs JOIN games gm ON gm.id=gs.game_id WHERE gs.player_id=p.id AND gm.voided_at IS NULL),
      longest_road_count=(SELECT count(*) FROM game_scores gs JOIN games gm ON gm.id=gs.game_id WHERE gs.player_id=p.id AND gs.longest_road AND gm.voided_at IS NULL),
      largest_army_count=(SELECT count(*) FROM game_scores gs JOIN games gm ON gm.id=gs.game_id WHERE gs.player_id=p.id AND gs.largest_army AND gm.voided_at IS NULL),
      win_streak=streak,best_win_streak=best,updated_at=now() WHERE player_id=p.id;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.record_chambers_game(p_request_id uuid,p_tournament_id uuid,p_game_number integer,p_date date,p_scores jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tournaments%ROWTYPE; s jsonb; winner uuid; existing games%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_tournament_id::text));
  SELECT * INTO existing FROM games WHERE id=p_request_id;
  IF FOUND THEN
    IF existing.tournament_id<>p_tournament_id OR existing.game_number<>p_game_number OR existing.date<>p_date OR existing.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Request ID already used for a different result.'; END IF;
    IF (SELECT jsonb_agg(jsonb_build_object('player_id',player_id,'points',points,'longest_road',longest_road,'largest_army',largest_army) ORDER BY player_id) FROM game_scores WHERE game_id=existing.id)
      IS DISTINCT FROM (SELECT jsonb_agg(value ORDER BY (value->>'player_id')::uuid) FROM jsonb_array_elements(p_scores)) THEN RAISE EXCEPTION 'Request ID already used for different scores.'; END IF;
    RETURN existing.id;
  END IF;
  SELECT * INTO t FROM tournaments WHERE id=p_tournament_id FOR UPDATE;
  IF NOT FOUND OR t.status<>'active' THEN RAISE EXCEPTION 'This season is not active.'; END IF;
  IF p_game_number<>coalesce((SELECT max(game_number)+1 FROM games WHERE tournament_id=t.id),1) THEN RAISE EXCEPTION 'Game number is out of date. Refresh and try again.'; END IF;
  IF (SELECT count(*) FROM games WHERE tournament_id=t.id AND voided_at IS NULL)>=t.total_games THEN RAISE EXCEPTION 'Season is full.'; END IF;
  IF p_date IS NULL OR p_date>current_date OR p_scores IS NULL OR jsonb_typeof(p_scores)<>'array' OR jsonb_array_length(p_scores)<>4 THEN RAISE EXCEPTION 'Invalid date or player count.'; END IF;
  IF (SELECT count(DISTINCT (value->>'player_id')::uuid) FROM jsonb_array_elements(p_scores))<>4 THEN RAISE EXCEPTION 'Duplicate players.'; END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(p_scores) LOOP
    IF NOT EXISTS(SELECT 1 FROM players WHERE id=(s->>'player_id')::uuid) OR jsonb_typeof(s->'points') IS DISTINCT FROM 'number' OR (s->>'points')::numeric<>trunc((s->>'points')::numeric) OR (s->>'points')::integer NOT BETWEEN 0 AND 12 OR jsonb_typeof(s->'longest_road') IS DISTINCT FROM 'boolean' OR jsonb_typeof(s->'largest_army') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid player score.'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(p_scores) WHERE (value->>'points')::integer>=10)<>1 THEN RAISE EXCEPTION 'Exactly one winner is required.'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_scores) WHERE (value->>'longest_road')::boolean)>1 OR (SELECT count(*) FROM jsonb_array_elements(p_scores) WHERE (value->>'largest_army')::boolean)>1 THEN RAISE EXCEPTION 'Only one holder per achievement.'; END IF;
  SELECT (value->>'player_id')::uuid INTO winner FROM jsonb_array_elements(p_scores) WHERE (value->>'points')::integer>=10;
  INSERT INTO games(id,tournament_id,game_number,date,winner_id) VALUES(p_request_id,t.id,p_game_number,p_date,winner);
  INSERT INTO game_scores(game_id,player_id,points,longest_road,largest_army) SELECT p_request_id,(value->>'player_id')::uuid,(value->>'points')::integer,(value->>'longest_road')::boolean,(value->>'largest_army')::boolean FROM jsonb_array_elements(p_scores);
  INSERT INTO chambers_audit(game_id,action) VALUES(p_request_id,'recorded');
  IF (SELECT count(*) FROM games WHERE tournament_id=t.id AND voided_at IS NULL)=t.total_games THEN UPDATE tournaments SET status='completed' WHERE id=t.id; END IF;
  PERFORM rebuild_chambers_stats(); RETURN p_request_id;
END $$;
CREATE OR REPLACE FUNCTION public.nullify_chambers_game(p_game_id uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tid uuid;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason))<3 OR length(p_reason)>500 THEN RAISE EXCEPTION 'A reason is required.'; END IF;
  SELECT tournament_id INTO tid FROM games WHERE id=p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(tid::text));
  UPDATE games SET voided_at=now(),void_reason=trim(p_reason) WHERE id=p_game_id AND voided_at IS NULL;
  IF FOUND THEN INSERT INTO chambers_audit(game_id,action,detail) VALUES(p_game_id,'nullified',trim(p_reason)); END IF;
  PERFORM rebuild_chambers_stats();
END $$;
CREATE OR REPLACE FUNCTION public.create_chambers_season(p_name text,p_total_games integer,p_prize_pool integer,p_tie text,p_road integer,p_army integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tid uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('chambers-season-create'));
  IF EXISTS(SELECT 1 FROM tournaments WHERE status='active') THEN RAISE EXCEPTION 'Finish the active season first.'; END IF;
  IF p_name IS NULL OR p_total_games IS NULL OR p_prize_pool IS NULL OR p_tie IS NULL OR p_road IS NULL OR p_army IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 60 OR p_total_games NOT BETWEEN 1 AND 100 OR p_prize_pool NOT BETWEEN 0 AND 1000000 OR p_tie NOT IN ('each','split','none') OR p_road NOT IN (0,10) OR p_army NOT IN (0,10) THEN RAISE EXCEPTION 'Invalid season rules.'; END IF;
  IF EXISTS(SELECT 1 FROM tournaments WHERE lower(name)=lower(trim(p_name))) THEN RAISE EXCEPTION 'A season with that name exists.'; END IF;
  INSERT INTO tournaments(name,total_games,prize_pool,status,road_bonus,army_bonus,bonus_tie_rule) VALUES(trim(p_name),p_total_games,p_prize_pool,'active',p_road,p_army,p_tie) RETURNING id INTO tid;
  PERFORM rebuild_chambers_stats(); RETURN tid;
END $$;
REVOKE ALL ON FUNCTION public.rebuild_chambers_stats() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_chambers_game(uuid,uuid,integer,date,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nullify_chambers_game(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_chambers_season(text,integer,integer,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_chambers_stats(),public.record_chambers_game(uuid,uuid,integer,date,jsonb),public.nullify_chambers_game(uuid,text),public.create_chambers_season(text,integer,integer,text,integer,integer) TO service_role;
CREATE TABLE IF NOT EXISTS public.chambers_login_attempts(key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.chambers_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chambers_login_attempts FROM anon,authenticated;
GRANT ALL ON public.chambers_login_attempts TO service_role;
CREATE OR REPLACE FUNCTION public.chambers_login_allowed(p_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM chambers_login_attempts WHERE window_start < now()-interval '1 day';
  INSERT INTO chambers_login_attempts AS a(key,attempts,window_start) VALUES(p_key,1,now())
  ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN a.window_start < now()-interval '15 minutes' THEN 1 ELSE a.attempts+1 END,window_start=CASE WHEN a.window_start < now()-interval '15 minutes' THEN now() ELSE a.window_start END
  RETURNING attempts INTO n;
  RETURN n<=10;
END $$;
REVOKE ALL ON FUNCTION public.chambers_login_allowed(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chambers_login_allowed(text) TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
