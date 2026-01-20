/*
  # Fix Archive Trigger Security

  ## Summary
  Changes the archive trigger function to run with SECURITY DEFINER
  so it executes with the privileges of the function owner (postgres)
  rather than the user calling it.

  ## Changes
  - Recreates the archive_order_before_delete function with SECURITY DEFINER
  - This allows the trigger to insert into archived_orders regardless of RLS

  ## Security Notes
  - Function runs with elevated privileges (postgres user)
  - Only performs INSERT into archived_orders, no other operations
  - Safe because it's only called automatically by the trigger
*/

-- Drop and recreate the function with SECURITY DEFINER
DROP FUNCTION IF EXISTS archive_order_before_delete() CASCADE;

CREATE OR REPLACE FUNCTION archive_order_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO archived_orders (
    id, partner_id, branch_id, user_id, status, total,
    created_at, order_number, address, phone, order_items_summary,
    payment_method_id, accepted_at, scheduled_at, extra_time_minutes,
    total_time_minutes, completed_at, completed_total_time_minutes,
    address_line, floor, apartment, entrance, intercom, office, comment,
    delivery_type, courier_id, total_amount, payment_status,
    accumulated_time_minutes, archived_at
  ) VALUES (
    OLD.id, OLD.partner_id, OLD.branch_id, OLD.user_id, OLD.status, OLD.total,
    OLD.created_at, OLD.order_number, OLD.address, OLD.phone, OLD.order_items_summary,
    OLD.payment_method_id, OLD.accepted_at, OLD.scheduled_at, OLD.extra_time_minutes,
    OLD.total_time_minutes, OLD.completed_at, OLD.completed_total_time_minutes,
    OLD.address_line, OLD.floor, OLD.apartment, OLD.entrance, OLD.intercom, OLD.office, OLD.comment,
    OLD.delivery_type, OLD.courier_id, OLD.total_amount, OLD.payment_status,
    OLD.accumulated_time_minutes, now()
  );
  RETURN OLD;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS archive_order_trigger ON orders;

CREATE TRIGGER archive_order_trigger
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION archive_order_before_delete();