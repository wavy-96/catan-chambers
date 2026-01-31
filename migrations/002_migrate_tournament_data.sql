-- Migration: Migrate existing data to tournaments
-- Run this AFTER 001_add_tournaments.sql

-- Update existing games to reference Catan 1.0
UPDATE public.games 
SET tournament_id = (SELECT id FROM public.tournaments WHERE name = 'Catan 1.0')
WHERE tournament_id IS NULL;

-- Copy player_stats to tournament_player_stats for Catan 1.0
INSERT INTO public.tournament_player_stats (tournament_id, player_id, total_games, wins, total_points, longest_road_count, largest_army_count, win_streak, best_win_streak)
SELECT 
  (SELECT id FROM public.tournaments WHERE name = 'Catan 1.0'),
  player_id, 
  total_games, 
  wins, 
  total_points, 
  longest_road_count, 
  largest_army_count, 
  win_streak, 
  best_win_streak
FROM public.player_stats;

-- Initialize tournament_player_stats for Catan 2.0 for all players
INSERT INTO public.tournament_player_stats (tournament_id, player_id, total_games, wins, total_points, longest_road_count, largest_army_count, win_streak, best_win_streak)
SELECT 
  (SELECT id FROM public.tournaments WHERE name = 'Catan 2.0'),
  id, 
  0, 0, 0, 0, 0, 0, 0
FROM public.players;
