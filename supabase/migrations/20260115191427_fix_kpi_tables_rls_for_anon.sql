/*
  # Fix KPI Tables RLS Policies for Anonymous Access

  This migration fixes the Row Level Security policies for KPI tables to allow
  anonymous (anon) role access, which is needed for frontend operations.

  ## Changes
  - Drop existing RLS policies that only work for authenticated users
  - Create new policies that allow anon role for all CRUD operations
  - Ensure proper access for frontend operations

  ## Tables Affected
  - kpi_indicator_catalog
  - kpi_templates
  - kpi_template_sections
  - kpi_template_indicators
  - kpi_indicator_settings
*/

-- Drop existing policies for kpi_indicator_catalog
DROP POLICY IF EXISTS "Users can read own partner kpi_indicator_catalog" ON kpi_indicator_catalog;
DROP POLICY IF EXISTS "Users can insert own partner kpi_indicator_catalog" ON kpi_indicator_catalog;
DROP POLICY IF EXISTS "Users can update own partner kpi_indicator_catalog" ON kpi_indicator_catalog;
DROP POLICY IF EXISTS "Users can delete own partner kpi_indicator_catalog" ON kpi_indicator_catalog;

-- Create new policies for kpi_indicator_catalog
CREATE POLICY "Allow select on kpi_indicator_catalog"
  ON kpi_indicator_catalog FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert on kpi_indicator_catalog"
  ON kpi_indicator_catalog FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update on kpi_indicator_catalog"
  ON kpi_indicator_catalog FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on kpi_indicator_catalog"
  ON kpi_indicator_catalog FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop existing policies for kpi_templates
DROP POLICY IF EXISTS "Users can read own partner kpi_templates" ON kpi_templates;
DROP POLICY IF EXISTS "Users can insert own partner kpi_templates" ON kpi_templates;
DROP POLICY IF EXISTS "Users can update own partner kpi_templates" ON kpi_templates;
DROP POLICY IF EXISTS "Users can delete own partner kpi_templates" ON kpi_templates;

-- Create new policies for kpi_templates
CREATE POLICY "Allow select on kpi_templates"
  ON kpi_templates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert on kpi_templates"
  ON kpi_templates FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update on kpi_templates"
  ON kpi_templates FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on kpi_templates"
  ON kpi_templates FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop existing policies for kpi_template_sections
DROP POLICY IF EXISTS "Users can read own partner kpi_template_sections" ON kpi_template_sections;
DROP POLICY IF EXISTS "Users can insert own partner kpi_template_sections" ON kpi_template_sections;
DROP POLICY IF EXISTS "Users can update own partner kpi_template_sections" ON kpi_template_sections;
DROP POLICY IF EXISTS "Users can delete own partner kpi_template_sections" ON kpi_template_sections;

-- Create new policies for kpi_template_sections
CREATE POLICY "Allow select on kpi_template_sections"
  ON kpi_template_sections FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert on kpi_template_sections"
  ON kpi_template_sections FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update on kpi_template_sections"
  ON kpi_template_sections FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on kpi_template_sections"
  ON kpi_template_sections FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop existing policies for kpi_template_indicators
DROP POLICY IF EXISTS "Users can read own partner kpi_template_indicators" ON kpi_template_indicators;
DROP POLICY IF EXISTS "Users can insert own partner kpi_template_indicators" ON kpi_template_indicators;
DROP POLICY IF EXISTS "Users can update own partner kpi_template_indicators" ON kpi_template_indicators;
DROP POLICY IF EXISTS "Users can delete own partner kpi_template_indicators" ON kpi_template_indicators;

-- Create new policies for kpi_template_indicators
CREATE POLICY "Allow select on kpi_template_indicators"
  ON kpi_template_indicators FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert on kpi_template_indicators"
  ON kpi_template_indicators FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update on kpi_template_indicators"
  ON kpi_template_indicators FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on kpi_template_indicators"
  ON kpi_template_indicators FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop existing policies for kpi_indicator_settings
DROP POLICY IF EXISTS "Users can read own partner kpi_indicator_settings" ON kpi_indicator_settings;
DROP POLICY IF EXISTS "Users can insert own partner kpi_indicator_settings" ON kpi_indicator_settings;
DROP POLICY IF EXISTS "Users can update own partner kpi_indicator_settings" ON kpi_indicator_settings;
DROP POLICY IF EXISTS "Users can delete own partner kpi_indicator_settings" ON kpi_indicator_settings;

-- Create new policies for kpi_indicator_settings
CREATE POLICY "Allow select on kpi_indicator_settings"
  ON kpi_indicator_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert on kpi_indicator_settings"
  ON kpi_indicator_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update on kpi_indicator_settings"
  ON kpi_indicator_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on kpi_indicator_settings"
  ON kpi_indicator_settings FOR DELETE
  TO anon, authenticated
  USING (true);
