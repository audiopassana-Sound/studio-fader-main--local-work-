-- Add stem name columns to projects table
ALTER TABLE public.projects
ADD COLUMN stem_1_name TEXT,
ADD COLUMN stem_2_name TEXT,
ADD COLUMN stem_3_name TEXT,
ADD COLUMN stem_4_name TEXT;