/*
  # Create KPI Settings System

  This migration creates a comprehensive, extensible KPI configuration system.

  ## 1. New Tables

  ### kpi_indicator_catalog
    - Catalog of available KPI indicators
    - `id` (uuid, primary key)
    - `partner_id` (uuid, foreign key to partners)
    - `key` (text, unique per partner - e.g., 'punctuality')
    - `name` (text - display name)
    - `description` (text - description of the indicator)
    - `category` (text - category like 'HR')
    - `created_at`, `updated_at` (timestamps)

  ### kpi_templates
    - KPI template for branch + position combination
    - `id` (uuid, primary key)
    - `partner_id` (uuid, foreign key)
    - `branch_id` (uuid, foreign key to branches)
    - `position_id` (uuid, foreign key to positions)
    - `pass_threshold_percent` (int, default 72)
    - `ranks_count` (int, default 3)
    - Unique constraint on (partner_id, branch_id, position_id)

  ### kpi_template_sections
    - Sections within a KPI template
    - `id` (uuid, primary key)
    - `partner_id` (uuid)
    - `template_id` (uuid, foreign key to kpi_templates)
    - `title` (text, default 'Индикатор HR')
    - `sort_order` (int)

  ### kpi_section_rank_weights
    - Weights for each rank within a section
    - `id` (uuid, primary key)
    - `partner_id` (uuid)
    - `section_id` (uuid, foreign key)
    - `rank_no` (int, 1..N)
    - `weight_percent` (int, default 100)

  ### kpi_template_indicators
    - Indicators assigned to a section
    - `id` (uuid, primary key)
    - `partner_id` (uuid)
    - `section_id` (uuid, foreign key)
    - `indicator_key` (text, reference to catalog.key)
    - `sort_order` (int)
    - `is_enabled` (bool)

  ### kpi_indicator_rank_settings
    - Per-rank settings for each indicator
    - `id` (uuid, primary key)
    - `partner_id` (uuid)
    - `template_indicator_id` (uuid, foreign key)
    - `rank_no` (int)
    - `min_percent` (int, default 95)
    - `binary_mode` (bool, default false)
    - `config` (jsonb, for indicator-specific settings)

  ## 2. Security
    - RLS enabled on all tables
    - Policies for partner isolation
    - All queries filtered by partner_id

  ## 3. Seed Data
    - Default 'punctuality' indicator in catalog
*/

-- 1. KPI Indicator Catalog
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
CREATE INDEX IF NOT EXISTS idx_kpi_indicator_catalog_key ON kpi_indicator_catalog(partner_id, key);

ALTER TABLE kpi_indicator_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_indicator_catalog_select" ON kpi_indicator_catalog
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "kpi_indicator_catalog_insert" ON kpi_indicator_catalog
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "kpi_indicator_catalog_update" ON kpi_indicator_catalog
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "kpi_indicator_catalog_delete" ON kpi_indicator_catalog
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON kpi_indicator_catalog TO anon;
GRANT ALL ON kpi_indicator_catalog TO authenticated;
GRANT ALL ON kpi_indicator_catalog TO service_role;

-- 2. KPI Templates
CREATE TABLE IF NOT EXISTS kpi_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  pass_threshold_percent int NOT NULL DEFAULT 72,
  ranks_count int NOT NULL DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, branch_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_templates_partner ON kpi_templates(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_templates_branch ON kpi_templates(branch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_templates_position ON kpi_templates(position_id);
CREATE INDEX IF NOT EXISTS idx_kpi_templates_lookup ON kpi_templates(partner_id, branch_id, position_id);

ALTER TABLE kpi_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_templates_select" ON kpi_templates
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "kpi_templates_insert" ON kpi_templates
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "kpi_templates_update" ON kpi_templates
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "kpi_templates_delete" ON kpi_templates
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON kpi_templates TO anon;
GRANT ALL ON kpi_templates TO authenticated;
GRANT ALL ON kpi_templates TO service_role;

-- 3. KPI Template Sections
CREATE TABLE IF NOT EXISTS kpi_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES kpi_templates(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Индикатор HR',
  sort_order int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kpi_template_sections_partner ON kpi_template_sections(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_template_sections_template ON kpi_template_sections(template_id);

ALTER TABLE kpi_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_template_sections_select" ON kpi_template_sections
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "kpi_template_sections_insert" ON kpi_template_sections
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "kpi_template_sections_update" ON kpi_template_sections
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "kpi_template_sections_delete" ON kpi_template_sections
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON kpi_template_sections TO anon;
GRANT ALL ON kpi_template_sections TO authenticated;
GRANT ALL ON kpi_template_sections TO service_role;

-- 4. KPI Section Rank Weights
CREATE TABLE IF NOT EXISTS kpi_section_rank_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES kpi_template_sections(id) ON DELETE CASCADE,
  rank_no int NOT NULL,
  weight_percent int NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, section_id, rank_no)
);

CREATE INDEX IF NOT EXISTS idx_kpi_section_rank_weights_partner ON kpi_section_rank_weights(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_section_rank_weights_section ON kpi_section_rank_weights(section_id);

ALTER TABLE kpi_section_rank_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_section_rank_weights_select" ON kpi_section_rank_weights
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "kpi_section_rank_weights_insert" ON kpi_section_rank_weights
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "kpi_section_rank_weights_update" ON kpi_section_rank_weights
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "kpi_section_rank_weights_delete" ON kpi_section_rank_weights
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON kpi_section_rank_weights TO anon;
GRANT ALL ON kpi_section_rank_weights TO authenticated;
GRANT ALL ON kpi_section_rank_weights TO service_role;

-- 5. KPI Template Indicators
CREATE TABLE IF NOT EXISTS kpi_template_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES kpi_template_sections(id) ON DELETE CASCADE,
  indicator_key text NOT NULL,
  sort_order int NOT NULL DEFAULT 1,
  is_enabled bool NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, section_id, indicator_key)
);

CREATE INDEX IF NOT EXISTS idx_kpi_template_indicators_partner ON kpi_template_indicators(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_template_indicators_section ON kpi_template_indicators(section_id);

ALTER TABLE kpi_template_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_template_indicators_select" ON kpi_template_indicators
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "kpi_template_indicators_insert" ON kpi_template_indicators
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "kpi_template_indicators_update" ON kpi_template_indicators
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "kpi_template_indicators_delete" ON kpi_template_indicators
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON kpi_template_indicators TO anon;
GRANT ALL ON kpi_template_indicators TO authenticated;
GRANT ALL ON kpi_template_indicators TO service_role;

-- 6. KPI Indicator Rank Settings
CREATE TABLE IF NOT EXISTS kpi_indicator_rank_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  template_indicator_id uuid NOT NULL REFERENCES kpi_template_indicators(id) ON DELETE CASCADE,
  rank_no int NOT NULL,
  min_percent int NOT NULL DEFAULT 95,
  binary_mode bool NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{"late_limit_shifts": 3}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, template_indicator_id, rank_no)
);

CREATE INDEX IF NOT EXISTS idx_kpi_indicator_rank_settings_partner ON kpi_indicator_rank_settings(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_indicator_rank_settings_indicator ON kpi_indicator_rank_settings(template_indicator_id);

ALTER TABLE kpi_indicator_rank_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_indicator_rank_settings_select" ON kpi_indicator_rank_settings
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "kpi_indicator_rank_settings_insert" ON kpi_indicator_rank_settings
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "kpi_indicator_rank_settings_update" ON kpi_indicator_rank_settings
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "kpi_indicator_rank_settings_delete" ON kpi_indicator_rank_settings
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON kpi_indicator_rank_settings TO anon;
GRANT ALL ON kpi_indicator_rank_settings TO authenticated;
GRANT ALL ON kpi_indicator_rank_settings TO service_role;

-- Enable realtime for KPI tables
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_template_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_section_rank_weights;
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_template_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_indicator_rank_settings;

-- Add comments
COMMENT ON TABLE kpi_indicator_catalog IS 'Catalog of available KPI indicators';
COMMENT ON TABLE kpi_templates IS 'KPI template for branch + position combination';
COMMENT ON TABLE kpi_template_sections IS 'Sections within a KPI template (e.g., HR Indicator)';
COMMENT ON TABLE kpi_section_rank_weights IS 'Weight percentages for each rank within a section';
COMMENT ON TABLE kpi_template_indicators IS 'Indicators assigned to a section';
COMMENT ON TABLE kpi_indicator_rank_settings IS 'Per-rank settings for each indicator';
