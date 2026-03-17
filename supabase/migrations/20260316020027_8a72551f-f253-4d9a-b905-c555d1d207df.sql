
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  venue text NOT NULL,
  city_id text NOT NULL DEFAULT 'mtl',
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  capacity integer DEFAULT 0,
  demand_impact integer NOT NULL DEFAULT 3 CHECK (demand_impact >= 1 AND demand_impact <= 5),
  boost_multiplier numeric NOT NULL DEFAULT 1.5,
  boost_radius_km numeric NOT NULL DEFAULT 3.0,
  boost_zone_types text[] DEFAULT '{}',
  category text NOT NULL DEFAULT 'event',
  is_holiday boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are publicly readable" ON public.events FOR SELECT TO public USING (true);
CREATE POLICY "Events are publicly insertable" ON public.events FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Events are publicly updatable" ON public.events FOR UPDATE TO public USING (true);
CREATE POLICY "Events are publicly deletable" ON public.events FOR DELETE TO public USING (true);
