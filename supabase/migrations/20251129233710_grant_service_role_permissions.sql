/*
  # Grant service_role full permissions on Poster tables

  1. Changes
    - Grant service_role usage on public schema
    - Grant full privileges on categories, products, modifiers, product_modifiers
    - Grant privileges on all tables and sequences for future-proofing
  
  2. Security
    - service_role is used by Edge Functions with service_role_key
    - This is secure as the key is only available server-side
*/

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant full access to Poster menu tables
GRANT ALL PRIVILEGES ON TABLE public.categories TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.products TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.modifiers TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.product_modifiers TO service_role;

-- Grant full access to all tables and sequences in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;