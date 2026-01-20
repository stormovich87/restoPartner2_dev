/*
  # Print Agent Module - Complete Setup

  1. New Columns in partner_settings
    - print_agent_name (text) - Agent display name
    - print_agent_base_url (text) - Local agent URL
    - print_agent_health_path (text) - Health check endpoint
    - print_agent_print_path (text) - Print endpoint
    - print_agent_version (text) - Current agent version
    - print_agent_apk_public_url (text) - APK download URL from Supabase Storage
    - print_agent_required (boolean) - Whether agent is required for printing

  2. New Tables
    - branch_devices: Devices registered at branches for cash register functionality
    - printers: Network printers available at branches
    - branch_print_settings: Print configuration per branch

  3. Security
    - Enable RLS on all new tables
    - Add policies for anon access (consistent with existing patterns)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_settings' AND column_name = 'print_agent_name') THEN
    ALTER TABLE partner_settings ADD COLUMN print_agent_name text DEFAULT 'Print Hub';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_settings' AND column_name = 'print_agent_base_url') THEN
    ALTER TABLE partner_settings ADD COLUMN print_agent_base_url text DEFAULT 'http://127.0.0.1:17800';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_settings' AND column_name = 'print_agent_health_path') THEN
    ALTER TABLE partner_settings ADD COLUMN print_agent_health_path text DEFAULT '/health';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_settings' AND column_name = 'print_agent_print_path') THEN
    ALTER TABLE partner_settings ADD COLUMN print_agent_print_path text DEFAULT '/print';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_settings' AND column_name = 'print_agent_version') THEN
    ALTER TABLE partner_settings ADD COLUMN print_agent_version text DEFAULT '1.0.0';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_settings' AND column_name = 'print_agent_apk_public_url') THEN
    ALTER TABLE partner_settings ADD COLUMN print_agent_apk_public_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_settings' AND column_name = 'print_agent_required') THEN
    ALTER TABLE partner_settings ADD COLUMN print_agent_required boolean DEFAULT true;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS branch_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Устройство',
  device_key text NOT NULL UNIQUE,
  printing_enabled boolean NOT NULL DEFAULT false,
  agent_status text NOT NULL DEFAULT 'unknown' CHECK (agent_status IN ('online', 'offline', 'unknown')),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  ip text NOT NULL,
  port int NOT NULL DEFAULT 9100,
  paper_width int NOT NULL DEFAULT 80 CHECK (paper_width IN (58, 80)),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branch_print_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
  printing_enabled boolean NOT NULL DEFAULT false,
  auto_print_new_order boolean NOT NULL DEFAULT false,
  auto_print_statuses text[] DEFAULT ARRAY[]::text[],
  default_printer_id uuid REFERENCES printers(id) ON DELETE SET NULL,
  copies int NOT NULL DEFAULT 1 CHECK (copies >= 1 AND copies <= 5),
  allowed_device_id uuid REFERENCES branch_devices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branch_devices_partner_id ON branch_devices(partner_id);
CREATE INDEX IF NOT EXISTS idx_branch_devices_branch_id ON branch_devices(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_devices_device_key ON branch_devices(device_key);
CREATE INDEX IF NOT EXISTS idx_printers_partner_id ON printers(partner_id);
CREATE INDEX IF NOT EXISTS idx_printers_branch_id ON printers(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_print_settings_partner_id ON branch_print_settings(partner_id);

ALTER TABLE branch_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_print_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branch_devices' AND policyname = 'Allow anon select branch_devices') THEN
    CREATE POLICY "Allow anon select branch_devices" ON branch_devices FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branch_devices' AND policyname = 'Allow anon insert branch_devices') THEN
    CREATE POLICY "Allow anon insert branch_devices" ON branch_devices FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branch_devices' AND policyname = 'Allow anon update branch_devices') THEN
    CREATE POLICY "Allow anon update branch_devices" ON branch_devices FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branch_devices' AND policyname = 'Allow anon delete branch_devices') THEN
    CREATE POLICY "Allow anon delete branch_devices" ON branch_devices FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'printers' AND policyname = 'Allow anon select printers') THEN
    CREATE POLICY "Allow anon select printers" ON printers FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'printers' AND policyname = 'Allow anon insert printers') THEN
    CREATE POLICY "Allow anon insert printers" ON printers FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'printers' AND policyname = 'Allow anon update printers') THEN
    CREATE POLICY "Allow anon update printers" ON printers FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'printers' AND policyname = 'Allow anon delete printers') THEN
    CREATE POLICY "Allow anon delete printers" ON printers FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branch_print_settings' AND policyname = 'Allow anon select branch_print_settings') THEN
    CREATE POLICY "Allow anon select branch_print_settings" ON branch_print_settings FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branch_print_settings' AND policyname = 'Allow anon insert branch_print_settings') THEN
    CREATE POLICY "Allow anon insert branch_print_settings" ON branch_print_settings FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branch_print_settings' AND policyname = 'Allow anon update branch_print_settings') THEN
    CREATE POLICY "Allow anon update branch_print_settings" ON branch_print_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branch_print_settings' AND policyname = 'Allow anon delete branch_print_settings') THEN
    CREATE POLICY "Allow anon delete branch_print_settings" ON branch_print_settings FOR DELETE TO anon USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON branch_devices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON printers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON branch_print_settings TO anon;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'branch_devices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE branch_devices;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'printers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE printers;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'branch_print_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE branch_print_settings;
  END IF;
END $$;

COMMENT ON TABLE branch_devices IS 'Devices registered at branches for cash register / printing';
COMMENT ON TABLE printers IS 'Network thermal printers at branches';
COMMENT ON TABLE branch_print_settings IS 'Print configuration settings per branch';
COMMENT ON COLUMN branch_devices.device_key IS 'Unique identifier stored in localStorage';
COMMENT ON COLUMN branch_devices.agent_status IS 'Print agent status: online/offline/unknown';
COMMENT ON COLUMN printers.paper_width IS 'Thermal paper width: 58 or 80 mm';
COMMENT ON COLUMN branch_print_settings.allowed_device_id IS 'Only this device can print for this branch';