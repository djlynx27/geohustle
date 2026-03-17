
CREATE TABLE public.earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  km numeric NOT NULL DEFAULT 0,
  duration_min integer DEFAULT 0,
  note text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Earnings are publicly readable" ON public.earnings FOR SELECT TO public USING (true);
CREATE POLICY "Earnings are publicly insertable" ON public.earnings FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Earnings are publicly updatable" ON public.earnings FOR UPDATE TO public USING (true);
CREATE POLICY "Earnings are publicly deletable" ON public.earnings FOR DELETE TO public USING (true);
