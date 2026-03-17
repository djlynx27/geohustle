
-- Create cities table
CREATE TABLE public.cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create zone_type enum
CREATE TYPE public.zone_type AS ENUM (
  'métro', 'commercial', 'résidentiel', 'nightlife', 'aéroport',
  'transport', 'médical', 'université', 'événements', 'tourisme'
);

-- Create zones table
CREATE TABLE public.zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.zone_type NOT NULL DEFAULT 'commercial',
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create time_slots table
CREATE TABLE public.time_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  city_id TEXT NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  demand_score INTEGER NOT NULL DEFAULT 0 CHECK (demand_score >= 0 AND demand_score <= 100),
  comment TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX idx_time_slots_lookup ON public.time_slots (city_id, date, start_time);
CREATE INDEX idx_zones_city ON public.zones (city_id);

-- Enable RLS
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

-- Public read/write access (no auth needed for this driver tool)
CREATE POLICY "Cities are publicly readable" ON public.cities FOR SELECT USING (true);
CREATE POLICY "Cities are publicly insertable" ON public.cities FOR INSERT WITH CHECK (true);
CREATE POLICY "Cities are publicly updatable" ON public.cities FOR UPDATE USING (true);
CREATE POLICY "Cities are publicly deletable" ON public.cities FOR DELETE USING (true);

CREATE POLICY "Zones are publicly readable" ON public.zones FOR SELECT USING (true);
CREATE POLICY "Zones are publicly insertable" ON public.zones FOR INSERT WITH CHECK (true);
CREATE POLICY "Zones are publicly updatable" ON public.zones FOR UPDATE USING (true);
CREATE POLICY "Zones are publicly deletable" ON public.zones FOR DELETE USING (true);

CREATE POLICY "TimeSlots are publicly readable" ON public.time_slots FOR SELECT USING (true);
CREATE POLICY "TimeSlots are publicly insertable" ON public.time_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "TimeSlots are publicly deletable" ON public.time_slots FOR DELETE USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_zones_updated_at
  BEFORE UPDATE ON public.zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
