-- Fighter Jet Analyzer Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Create the main table for analyzed data
CREATE TABLE IF NOT EXISTS analyzed_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  analysis JSONB,
  sentiment TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  analyzed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_created_at ON analyzed_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status ON analyzed_data(status);
CREATE INDEX IF NOT EXISTS idx_analyzed_at ON analyzed_data(analyzed_at DESC);

-- If you already created the table without these columns, run these ALTER statements instead:
-- ALTER TABLE analyzed_data ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending';
-- ALTER TABLE analyzed_data ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;
-- ALTER TABLE analyzed_data ADD COLUMN IF NOT EXISTS error_message TEXT;
-- CREATE INDEX IF NOT EXISTS idx_status ON analyzed_data(status);
-- CREATE INDEX IF NOT EXISTS idx_analyzed_at ON analyzed_data(analyzed_at DESC);

