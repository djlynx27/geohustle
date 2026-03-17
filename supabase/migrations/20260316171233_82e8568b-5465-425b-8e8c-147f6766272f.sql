
-- 1. Add columns to zones table
ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS territory text DEFAULT '',
  ADD COLUMN IF NOT EXISTS category text DEFAULT '',
  ADD COLUMN IF NOT EXISTS address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS base_score integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS current_score integer DEFAULT 50;

-- 2. Add columns to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_attendance integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- 3. Create trips table
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  earnings numeric DEFAULT 0,
  tips numeric DEFAULT 0,
  distance_km numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trips are publicly readable" ON public.trips FOR SELECT USING (true);
CREATE POLICY "Trips are publicly insertable" ON public.trips FOR INSERT WITH CHECK (true);
CREATE POLICY "Trips are publicly updatable" ON public.trips FOR UPDATE USING (true);
CREATE POLICY "Trips are publicly deletable" ON public.trips FOR DELETE USING (true);

-- 4. Create scores table
CREATE TABLE public.scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE NOT NULL,
  score integer DEFAULT 0,
  weather_boost integer DEFAULT 0,
  event_boost integer DEFAULT 0,
  final_score integer DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scores are publicly readable" ON public.scores FOR SELECT USING (true);
CREATE POLICY "Scores are publicly insertable" ON public.scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Scores are publicly updatable" ON public.scores FOR UPDATE USING (true);
CREATE POLICY "Scores are publicly deletable" ON public.scores FOR DELETE USING (true);

-- 5. Create score_history table
CREATE TABLE public.score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE NOT NULL,
  score integer DEFAULT 0,
  reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ScoreHistory are publicly readable" ON public.score_history FOR SELECT USING (true);
CREATE POLICY "ScoreHistory are publicly insertable" ON public.score_history FOR INSERT WITH CHECK (true);

-- 6. Create driver_notes table
CREATE TABLE public.driver_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE NOT NULL,
  note text NOT NULL,
  trip_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DriverNotes are publicly readable" ON public.driver_notes FOR SELECT USING (true);
CREATE POLICY "DriverNotes are publicly insertable" ON public.driver_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "DriverNotes are publicly updatable" ON public.driver_notes FOR UPDATE USING (true);
CREATE POLICY "DriverNotes are publicly deletable" ON public.driver_notes FOR DELETE USING (true);

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scores_zone_id ON public.scores(zone_id);
CREATE INDEX IF NOT EXISTS idx_scores_calculated_at ON public.scores(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_history_zone_id ON public.score_history(zone_id);
CREATE INDEX IF NOT EXISTS idx_trips_zone_id ON public.trips(zone_id);
CREATE INDEX IF NOT EXISTS idx_driver_notes_zone_id ON public.driver_notes(zone_id);

-- 8. Enable pg_cron and pg_net for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
