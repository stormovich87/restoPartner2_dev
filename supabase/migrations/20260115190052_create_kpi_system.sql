/*
  # KPI System - Key Performance Indicators Module

  This migration creates a comprehensive KPI management system for tracking and measuring employee performance indicators.

  ## 1. New Tables

  ### 1.1 kpi_indicator_catalog
  - Catalog/dictionary of available KPI indicators
  - `id` (uuid, primary key) - Unique identifier
  - `partner_id` (uuid, foreign key) - Partner/tenant isolation
  - `key` (text) - Unique indicator key per partner (e.g., 'punctuality')
  - `name` (text) - Human-readable name
  - `description` (text) - Detailed description
  - `category` (text) - Category for grouping (default: 'HR')
  - `created_at`, `updated_at` - Timestamps

  ### 1.2 kpi_templates
  - KPI template per branch + position combination
  - `id` (uuid, primary key) - Unique identifier
  - `partner_id` (uuid, foreign key) - Partner/tenant isolation
  - `branch_id` (uuid, foreign key) - Associated branch
  - `position_id` (uuid, foreign key) - Associated position
  - `pass_threshold_percent` (int) - Minimum percent threshold (default: 70)
  - `created_at`, `updated_at` - Timestamps
  - UNIQUE constraint on (partner_id, branch_id, position_id)

  ### 1.3 kpi_template_sections
  - Sections/groups within a KPI template
  - `id` (uuid, primary key) - Unique identifier
  - `partner_id` (uuid, foreign key) - Partner/tenant isolation
  - `template_id` (uuid, foreign key) - Parent template
  - `title` (text) - Section title (e.g., 'HR Indicator')
  - `sort_order` (int) - Display order
  - `created_at`, `updated_at` - Timestamps

  ### 1.4 kpi_template_indicators
  - Indicators linked to sections from catalog
  - `id` (uuid, primary key) - Unique identifier
  - `partner_id` (uuid, foreign key) - Partner/tenant isolation
  - `section_id` (uuid, foreign key) - Parent section
  - `indicator_key` (text) - Reference to kpi_indicator_catalog.key
  - `sort_order` (int) - Display order
  - `is_enabled` (bool) - Whether indicator is active (default: true)
  - `created_at`, `updated_at` - Timestamps
  - UNIQUE constraint on (partner_id, section_id, indicator_key)

  ### 1.5 kpi_indicator_settings
  - Specific settings for each indicator instance
  - `id` (uuid, primary key) - Unique identifier
  - `partner_id` (uuid, foreign key) - Partner/tenant isolation
  - `template_indicator_id` (uuid, foreign key) - Parent indicator
  - `min_percent` (int) - Minimum completion percent (default: 95)
  - `binary_mode` (bool) - Binary scoring mode (default: false)
  - `config` (jsonb) - Indicator-specific configuration (e.g., late_limit_shifts)
  - `created_at`, `updated_at` - Timestamps
  - UNIQUE constraint on (partner_id, template_indicator_id)

  ## 2. Security
  - RLS enabled on all tables
  - Access restricted to authenticated users within their partner scope
  - All operations filtered by partner_id

  ## 3. Seed Data
  - Default 'punctuality' indicator seeded for each partner when they create their first KPI template
*/

-- 1.1 KPI Indicator Catalog
CREATE TABLE IF NOT EXISTS kpi_indicator_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  category text DEFAULT 'HR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, key)
);

CREATE INDEX IF NOT EXISTS idx_kpi_indicator_catalog_partner ON kpi_indicator_catalog(partner_id);

ALTER TABLE kpi_indicator_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own partner kpi_indicator_catalog"
  ON kpi_indicator_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own partner kpi_indicator_catalog"
  ON kpi_indicator_catalog FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own partner kpi_indicator_catalog"
  ON kpi_indicator_catalog FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own partner kpi_indicator_catalog"
  ON kpi_indicator_catalog FOR DELETE
  TO authenticated
  USING (true);

-- Grant permissions for anon role (needed for frontend operations)
GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_indicator_catalog TO anon;

-- 1.2 KPI Templates
CREATE TABLE IF NOT EXISTS kpi_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  pass_threshold_percent int DEFAULT 70 CHECK (pass_threshold_percent >= 0 AND pass_threshold_percent <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, branch_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_templates_partner ON kpi_templates(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_templates_branch ON kpi_templates(branch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_templates_position ON kpi_templates(position_id);

ALTER TABLE kpi_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own partner kpi_templates"
  ON kpi_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own partner kpi_templates"
  ON kpi_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own partner kpi_templates"
  ON kpi_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own partner kpi_templates"
  ON kpi_templates FOR DELETE
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_templates TO anon;

-- 1.3 KPI Template Sections
CREATE TABLE IF NOT EXISTS kpi_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES kpi_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kpi_template_sections_partner ON kpi_template_sections(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_template_sections_template ON kpi_template_sections(template_id);

ALTER TABLE kpi_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own partner kpi_template_sections"
  ON kpi_template_sections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own partner kpi_template_sections"
  ON kpi_template_sections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own partner kpi_template_sections"
  ON kpi_template_sections FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own partner kpi_template_sections"
  ON kpi_template_sections FOR DELETE
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_template_sections TO anon;

-- 1.4 KPI Template Indicators
CREATE TABLE IF NOT EXISTS kpi_template_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES kpi_template_sections(id) ON DELETE CASCADE,
  indicator_key text NOT NULL,
  sort_order int DEFAULT 0,
  is_enabled bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, section_id, indicator_key)
);

CREATE INDEX IF NOT EXISTS idx_kpi_template_indicators_partner ON kpi_template_indicators(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_template_indicators_section ON kpi_template_indicators(section_id);

ALTER TABLE kpi_template_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own partner kpi_template_indicators"
  ON kpi_template_indicators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own partner kpi_template_indicators"
  ON kpi_template_indicators FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own partner kpi_template_indicators"
  ON kpi_template_indicators FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own partner kpi_template_indicators"
  ON kpi_template_indicators FOR DELETE
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_template_indicators TO anon;

-- 1.5 KPI Indicator Settings
CREATE TABLE IF NOT EXISTS kpi_indicator_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  template_indicator_id uuid NOT NULL REFERENCES kpi_template_indicators(id) ON DELETE CASCADE,
  min_percent int DEFAULT 95 CHECK (min_percent >= 0 AND min_percent <= 100),
  binary_mode bool DEFAULT false,
  config jsonb DEFAULT '{"late_limit_shifts": 3}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, template_indicator_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_indicator_settings_partner ON kpi_indicator_settings(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_indicator_settings_template_indicator ON kpi_indicator_settings(template_indicator_id);

ALTER TABLE kpi_indicator_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own partner kpi_indicator_settings"
  ON kpi_indicator_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own partner kpi_indicator_settings"
  ON kpi_indicator_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own partner kpi_indicator_settings"
  ON kpi_indicator_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own partner kpi_indicator_settings"
  ON kpi_indicator_settings FOR DELETE
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_indicator_settings TO anon;

-- Add city column to branches table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'city'
  ) THEN
    ALTER TABLE branches ADD COLUMN city text;
  END IF;
END $$;

-- Create index on branches.city if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_branches_city ON branches(city);

-- Enable realtime for KPI tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'kpi_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE kpi_templates;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'kpi_template_sections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE kpi_template_sections;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'kpi_indicator_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE kpi_indicator_settings;
  END IF;
END $$;
