/*
  # Add Binotel Company ID to Partner Settings

  ## Overview
  This migration adds the Company ID field to partner settings for Binotel integration.
  Each partner can now have their own unique Binotel company identifier.

  ## Changes
    - Adds `binotel_company_id` (text, nullable) to partner_settings table
    
  ## Purpose
    - Allow multiple partners to use different Binotel accounts
    - Enable webhook routing based on Company ID
    - Support multi-tenant Binotel integration
    
  ## Security
    - Company ID is used to match incoming webhooks to the correct partner
    - Only authenticated users can view/modify these settings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'binotel_company_id'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN binotel_company_id text;
  END IF;
END $$;