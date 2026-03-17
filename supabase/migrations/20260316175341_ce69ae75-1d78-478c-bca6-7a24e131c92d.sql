-- Create storage bucket for driver screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-screenshots', 'driver-screenshots', true);

-- Allow public uploads to driver-screenshots bucket
CREATE POLICY "Anyone can upload screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'driver-screenshots');

-- Allow public reads from driver-screenshots bucket
CREATE POLICY "Screenshots are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'driver-screenshots');

-- Allow public deletes from driver-screenshots bucket
CREATE POLICY "Screenshots are publicly deletable"
ON storage.objects FOR DELETE
USING (bucket_id = 'driver-screenshots');
