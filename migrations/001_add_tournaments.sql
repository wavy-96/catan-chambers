-- Migration: Add multi-tournament support
-- Run this in Supabase SQL Editor

-- 1. Create tournaments table
CREATE TABLE public.tournaments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  total_games integer NOT NULL DEFAULT 20,
  prize_pool integer DEFAULT 10000,
  status varchar NOT NULL DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournaments_pkey PRIMARY KEY (id)
);

-- 2. Add tournament_id to games table
ALTER TABLE public.games 
ADD COLUMN tournament_id uuid REFERENCES public.tournaments(id);

-- 3. Create tournament_player_stats table
CREATE TABLE public.tournament_player_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.tournaments(id),
  player_id uuid REFERENCES public.players(id),
  total_games integer DEFAULT 0,
  wins integer DEFAULT 0,
  total_points integer DEFAULT 0,
  longest_road_count integer DEFAULT 0,
  largest_army_count integer DEFAULT 0,
  win_streak integer DEFAULT 0,
  best_win_streak integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_player_stats_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_player_stats_unique UNIQUE (tournament_id, player_id)
);

-- 4. Enable RLS on new tables
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_player_stats ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for tournaments (read-only for anon)
CREATE POLICY "Allow public read access to tournaments" ON public.tournaments
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to tournament_player_stats" ON public.tournament_player_stats
  FOR SELECT USING (true);

-- 6. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_player_stats;

-- 7. Insert Catan 1.0 tournament (completed) and link existing games
INSERT INTO public.tournaments (name, total_games, prize_pool, status)
VALUES ('Catan 1.0', 20, 10000, 'completed')
RETURNING id;

-- Note: Run this separately after getting the tournament ID from above
-- UPDATE public.games SET tournament_id = '<catan_1_id>' WHERE tournament_id IS NULL;

-- 8. Insert Catan 2.0 tournament (active)
INSERT INTO public.tournaments (name, total_games, prize_pool, status)
VALUES ('Catan 2.0', 20, 10000, 'active');

-- 9. Copy player_stats to tournament_player_stats for Catan 1.0
-- Run after step 7 to get the tournament_id
-- INSERT INTO public.tournament_player_stats (tournament_id, player_id, total_games, wins, total_points, longest_road_count, largest_army_count, win_streak, best_win_streak)
-- SELECT '<catan_1_id>', player_id, total_games, wins, total_points, longest_road_count, largest_army_count, win_streak, best_win_streak
-- FROM public.player_stats;

-- 10. Initialize tournament_player_stats for Catan 2.0 for all players
-- Run after step 8 to get the tournament_id
-- INSERT INTO public.tournament_player_stats (tournament_id, player_id, total_games, wins, total_points, longest_road_count, largest_army_count, win_streak, best_win_streak)
-- SELECT '<catan_2_id>', id, 0, 0, 0, 0, 0, 0, 0
-- FROM public.players;
