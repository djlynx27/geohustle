
-- Add experiment flag to trips
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS experiment boolean NOT NULL DEFAULT false;

-- Create daily_reports table
CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  total_earnings numeric DEFAULT 0,
  total_distance_km numeric DEFAULT 0,
  hours_worked numeric DEFAULT 0,
  best_zone_name text DEFAULT '',
  worst_zone_name text DEFAULT '',
  best_time_slot text DEFAULT '',
  dead_time_pct numeric DEFAULT 0,
  ai_recommendation text DEFAULT '',
  total_trips integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DailyReports are publicly readable" ON public.daily_reports FOR SELECT USING (true);
CREATE POLICY "DailyReports are publicly insertable" ON public.daily_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "DailyReports are publicly updatable" ON public.daily_reports FOR UPDATE USING (true);
CREATE POLICY "DailyReports are publicly deletable" ON public.daily_reports FOR DELETE USING (true);
