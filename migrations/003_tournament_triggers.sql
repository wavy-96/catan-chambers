-- Migration: Create triggers for tournament_player_stats
-- Run this AFTER 002_migrate_tournament_data.sql

-- Function to update tournament_player_stats when a game is added
CREATE OR REPLACE FUNCTION update_tournament_player_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament_id uuid;
  v_winner_id uuid;
  v_player record;
  v_current_streak integer;
  v_best_streak integer;
BEGIN
  -- Get tournament_id from the game
  IF TG_OP = 'DELETE' THEN
    SELECT tournament_id INTO v_tournament_id FROM public.games WHERE id = OLD.game_id;
  ELSE
    SELECT tournament_id, winner_id INTO v_tournament_id, v_winner_id FROM public.games WHERE id = NEW.game_id;
  END IF;

  -- Skip if no tournament_id
  IF v_tournament_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Update stats for the player
    INSERT INTO public.tournament_player_stats (tournament_id, player_id, total_games, wins, total_points, longest_road_count, largest_army_count, win_streak, best_win_streak)
    VALUES (
      v_tournament_id,
      NEW.player_id,
      1,
      CASE WHEN v_winner_id = NEW.player_id THEN 1 ELSE 0 END,
      NEW.points,
      CASE WHEN NEW.longest_road THEN 1 ELSE 0 END,
      CASE WHEN NEW.largest_army THEN 1 ELSE 0 END,
      CASE WHEN v_winner_id = NEW.player_id THEN 1 ELSE 0 END,
      CASE WHEN v_winner_id = NEW.player_id THEN 1 ELSE 0 END
    )
    ON CONFLICT (tournament_id, player_id)
    DO UPDATE SET
      total_games = tournament_player_stats.total_games + 1,
      wins = tournament_player_stats.wins + CASE WHEN v_winner_id = NEW.player_id THEN 1 ELSE 0 END,
      total_points = tournament_player_stats.total_points + NEW.points,
      longest_road_count = tournament_player_stats.longest_road_count + CASE WHEN NEW.longest_road THEN 1 ELSE 0 END,
      largest_army_count = tournament_player_stats.largest_army_count + CASE WHEN NEW.largest_army THEN 1 ELSE 0 END,
      win_streak = CASE 
        WHEN v_winner_id = NEW.player_id THEN tournament_player_stats.win_streak + 1 
        ELSE 0 
      END,
      best_win_streak = GREATEST(
        tournament_player_stats.best_win_streak,
        CASE WHEN v_winner_id = NEW.player_id THEN tournament_player_stats.win_streak + 1 ELSE tournament_player_stats.best_win_streak END
      ),
      updated_at = now();

    -- Also update global player_stats
    UPDATE public.player_stats
    SET
      total_games = player_stats.total_games + 1,
      wins = player_stats.wins + CASE WHEN v_winner_id = NEW.player_id THEN 1 ELSE 0 END,
      total_points = player_stats.total_points + NEW.points,
      longest_road_count = player_stats.longest_road_count + CASE WHEN NEW.longest_road THEN 1 ELSE 0 END,
      largest_army_count = player_stats.largest_army_count + CASE WHEN NEW.largest_army THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE player_id = NEW.player_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Recalculate stats for the player in this tournament
    -- This is a simplified version - in production you'd want full recalculation
    UPDATE public.tournament_player_stats
    SET
      total_games = GREATEST(0, tournament_player_stats.total_games - 1),
      wins = GREATEST(0, tournament_player_stats.wins - CASE WHEN v_winner_id = OLD.player_id THEN 1 ELSE 0 END),
      total_points = GREATEST(0, tournament_player_stats.total_points - OLD.points),
      longest_road_count = GREATEST(0, tournament_player_stats.longest_road_count - CASE WHEN OLD.longest_road THEN 1 ELSE 0 END),
      largest_army_count = GREATEST(0, tournament_player_stats.largest_army_count - CASE WHEN OLD.largest_army THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE tournament_id = v_tournament_id AND player_id = OLD.player_id;

    -- Also update global player_stats
    UPDATE public.player_stats
    SET
      total_games = GREATEST(0, player_stats.total_games - 1),
      wins = GREATEST(0, player_stats.wins - CASE WHEN v_winner_id = OLD.player_id THEN 1 ELSE 0 END),
      total_points = GREATEST(0, player_stats.total_points - OLD.points),
      longest_road_count = GREATEST(0, player_stats.longest_road_count - CASE WHEN OLD.longest_road THEN 1 ELSE 0 END),
      largest_army_count = GREATEST(0, player_stats.largest_army_count - CASE WHEN OLD.largest_army THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE player_id = OLD.player_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on game_scores
DROP TRIGGER IF EXISTS on_game_score_change ON public.game_scores;
CREATE TRIGGER on_game_score_change
  AFTER INSERT OR DELETE ON public.game_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_player_stats();
