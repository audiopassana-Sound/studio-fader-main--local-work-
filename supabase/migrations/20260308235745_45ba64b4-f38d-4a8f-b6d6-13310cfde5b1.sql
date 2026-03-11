-- Create permissive policies for audio_files bucket
-- Note: RLS is already enabled on storage.objects by default

-- Allow anyone to read files from audio_files bucket
CREATE POLICY "Allow public read access to audio_files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audio_files');

-- Allow anyone to upload files to audio_files bucket
CREATE POLICY "Allow public insert access to audio_files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'audio_files');

-- Allow anyone to update files in audio_files bucket
CREATE POLICY "Allow public update access to audio_files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'audio_files')
WITH CHECK (bucket_id = 'audio_files');

-- Allow anyone to delete files from audio_files bucket
CREATE POLICY "Allow public delete access to audio_files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'audio_files');