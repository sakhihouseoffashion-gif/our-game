-- 1. Create Tables
CREATE TABLE public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  host_player_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, playing, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY, -- Maps to auth.uid()
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.room_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- host, guest
  display_name TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE public.memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id),
  storage_path TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'selecting', -- selecting, playing, completed
  current_player_id UUID REFERENCES public.profiles(id),
  selected_memory_id UUID REFERENCES public.memories(id),
  used_memory_ids UUID[] DEFAULT '{}',
  difficulty TEXT DEFAULT 'medium',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  turn_started_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.puzzle_pieces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  piece_index INT NOT NULL,
  correct_position JSONB NOT NULL, -- {x, y}
  current_position JSONB, -- {x, y} (when locked)
  locked BOOLEAN DEFAULT false,
  placed_by UUID REFERENCES public.profiles(id),
  placed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(game_session_id, player_id)
);

CREATE TABLE public.rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  reward_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(room_id)
);

CREATE TABLE public.completed_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  memory_id UUID REFERENCES public.memories(id),
  winner_id UUID REFERENCES public.profiles(id),
  player_1_score INT,
  player_2_score INT,
  reward_text TEXT,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Setup Storage Bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('memories', 'memories', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Row Level Security (RLS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completed_memories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to do anything for MVP 
-- (in production, we would scope this down by room access)
CREATE POLICY "Enable all for authenticated users" ON public.rooms FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.room_players FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.memories FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.game_sessions FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.puzzle_pieces FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.scores FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.rewards FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.completed_memories FOR ALL TO authenticated USING (true);

-- Storage policies
CREATE POLICY "Give users access to own folder 1qazxsw" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'memories');
CREATE POLICY "Give users access to own folder 1qazxsw 2" ON storage.objects FOR SELECT TO public USING (bucket_id = 'memories');
CREATE POLICY "Give users access to own folder 1qazxsw 3" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'memories');
CREATE POLICY "Give users access to own folder 1qazxsw 4" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'memories');

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.puzzle_pieces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;

-- 5. Create RPCs
CREATE OR REPLACE FUNCTION public.start_game(p_room_id UUID, p_difficulty TEXT)
RETURNS UUID AS $$
DECLARE
  v_memory_id UUID;
  v_session_id UUID;
  v_host_id UUID;
  v_used_memories UUID[];
  v_pieces_count INT;
  i INT;
  v_cols INT;
  v_rows INT;
BEGIN
  SELECT host_player_id INTO v_host_id FROM public.rooms WHERE id = p_room_id;
  
  SELECT array_agg(memory_id) INTO v_used_memories FROM public.completed_memories cm 
  JOIN public.game_sessions gs ON cm.game_session_id = gs.id 
  WHERE gs.room_id = p_room_id;
  
  IF v_used_memories IS NULL THEN
    v_used_memories := ARRAY[]::UUID[];
  END IF;

  SELECT id INTO v_memory_id
  FROM public.memories
  WHERE room_id = p_room_id 
    AND is_active = true
    AND (array_length(v_used_memories, 1) IS NULL OR id != ALL(v_used_memories))
  ORDER BY random()
  LIMIT 1;

  IF v_memory_id IS NULL THEN
    SELECT id INTO v_memory_id
    FROM public.memories
    WHERE room_id = p_room_id AND is_active = true
    ORDER BY random()
    LIMIT 1;
    v_used_memories := ARRAY[]::UUID[];
  END IF;
  
  IF v_memory_id IS NULL THEN
    RAISE EXCEPTION 'No memories found for room';
  END IF;

  v_used_memories := array_append(v_used_memories, v_memory_id);

  INSERT INTO public.game_sessions (room_id, status, current_player_id, selected_memory_id, used_memory_ids, difficulty, started_at)
  VALUES (p_room_id, 'playing', v_host_id, v_memory_id, v_used_memories, p_difficulty, now())
  RETURNING id INTO v_session_id;

  IF p_difficulty = 'easy' THEN
    v_cols := 3; v_rows := 3;
  ELSIF p_difficulty = 'medium' THEN
    v_cols := 4; v_rows := 4;
  ELSE
    v_cols := 5; v_rows := 5;
  END IF;

  v_pieces_count := v_cols * v_rows;

  FOR i IN 0..(v_pieces_count - 1) LOOP
    INSERT INTO public.puzzle_pieces (game_session_id, piece_index, correct_position)
    VALUES (
      v_session_id, 
      i, 
      jsonb_build_object('x', i % v_cols, 'y', floor(i / v_cols))
    );
  END LOOP;

  UPDATE public.rooms SET status = 'playing' WHERE id = p_room_id;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.place_piece(p_session_id UUID, p_piece_index INT, p_x INT, p_y INT)
RETURNS BOOLEAN AS $$
DECLARE
  v_session RECORD;
  v_piece RECORD;
  v_is_correct BOOLEAN;
  v_other_player_id UUID;
  v_unlocked_count INT;
  v_reward TEXT;
  v_p1_score INT;
  v_p2_score INT;
  v_winner_id UUID;
BEGIN
  SELECT * INTO v_session FROM public.game_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_session.status != 'playing' THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  IF v_session.current_player_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  SELECT * INTO v_piece FROM public.puzzle_pieces WHERE game_session_id = p_session_id AND piece_index = p_piece_index;
  IF NOT FOUND OR v_piece.locked THEN
    RAISE EXCEPTION 'Piece already locked or invalid';
  END IF;

  v_is_correct := (v_piece.correct_position->>'x')::INT = p_x AND (v_piece.correct_position->>'y')::INT = p_y;

  INSERT INTO public.scores (game_session_id, player_id, score)
  VALUES (p_session_id, auth.uid(), CASE WHEN v_is_correct THEN 10 ELSE -2 END)
  ON CONFLICT (game_session_id, player_id) 
  DO UPDATE SET score = GREATEST(0, public.scores.score + EXCLUDED.score), updated_at = now();

  IF v_is_correct THEN
    UPDATE public.puzzle_pieces 
    SET locked = true, current_position = jsonb_build_object('x', p_x, 'y', p_y), placed_by = auth.uid(), placed_at = now()
    WHERE id = v_piece.id;
  END IF;

  SELECT user_id INTO v_other_player_id FROM public.room_players 
  WHERE room_id = v_session.room_id AND user_id != auth.uid() LIMIT 1;

  UPDATE public.game_sessions 
  SET current_player_id = COALESCE(v_other_player_id, auth.uid()), turn_started_at = now()
  WHERE id = p_session_id;

  SELECT count(*) INTO v_unlocked_count FROM public.puzzle_pieces WHERE game_session_id = p_session_id AND locked = false;

  IF v_unlocked_count = 0 THEN
    UPDATE public.scores SET score = score + 25 WHERE game_session_id = p_session_id AND player_id = auth.uid();
    
    SELECT COALESCE(MAX(score) FILTER (WHERE player_id = v_session.current_player_id), 0) INTO v_p1_score FROM public.scores WHERE game_session_id = p_session_id;
    SELECT COALESCE(MAX(score) FILTER (WHERE player_id = v_other_player_id), 0) INTO v_p2_score FROM public.scores WHERE game_session_id = p_session_id;
    
    IF v_p1_score > v_p2_score THEN v_winner_id := v_session.current_player_id;
    ELSIF v_p2_score > v_p1_score THEN v_winner_id := v_other_player_id;
    ELSE v_winner_id := NULL;
    END IF;

    SELECT reward_text INTO v_reward FROM public.rewards WHERE room_id = v_session.room_id LIMIT 1;

    INSERT INTO public.completed_memories (game_session_id, memory_id, winner_id, player_1_score, player_2_score, reward_text)
    VALUES (p_session_id, v_session.selected_memory_id, v_winner_id, v_p1_score, v_p2_score, v_reward);

    UPDATE public.game_sessions SET status = 'completed', completed_at = now() WHERE id = p_session_id;
    UPDATE public.rooms SET status = 'waiting' WHERE id = v_session.room_id;
  END IF;

  RETURN v_is_correct;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.pass_turn(p_session_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_session RECORD;
  v_other_player_id UUID;
BEGIN
  SELECT * INTO v_session FROM public.game_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_session.status != 'playing' THEN RAISE EXCEPTION 'Invalid session'; END IF;
  IF v_session.current_player_id != auth.uid() THEN RAISE EXCEPTION 'Not your turn'; END IF;

  SELECT user_id INTO v_other_player_id FROM public.room_players WHERE room_id = v_session.room_id AND user_id != auth.uid() LIMIT 1;
  UPDATE public.game_sessions SET current_player_id = COALESCE(v_other_player_id, auth.uid()), turn_started_at = now() WHERE id = p_session_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.use_hint(p_session_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT * INTO v_session FROM public.game_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_session.status != 'playing' THEN RAISE EXCEPTION 'Invalid session'; END IF;
  IF v_session.current_player_id != auth.uid() THEN RAISE EXCEPTION 'Not your turn'; END IF;

  INSERT INTO public.scores (game_session_id, player_id, score) VALUES (p_session_id, auth.uid(), -5)
  ON CONFLICT (game_session_id, player_id) DO UPDATE SET score = GREATEST(0, public.scores.score + EXCLUDED.score), updated_at = now();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
