/*
  # Reset courier payment when order status is reverted

  1. Changes
    - Create trigger to reset courier_payment_amount when order status changes from 'completed' to 'in_progress' or 'en_route'
    - This allows recalculation with current settings when order is completed again

  2. Flow
    - Order completed -> courier_payment_amount saved to archive
    - Order reverted to in_progress/en_route -> courier_payment_amount reset to NULL
    - Order completed again -> new courier_payment_amount calculated and saved
*/

CREATE OR REPLACE FUNCTION reset_courier_payment_on_status_revert()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status IN ('in_progress', 'en_route') THEN
    NEW.courier_payment_amount := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reset_courier_payment_on_revert ON orders;

CREATE TRIGGER trigger_reset_courier_payment_on_revert
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION reset_courier_payment_on_status_revert();