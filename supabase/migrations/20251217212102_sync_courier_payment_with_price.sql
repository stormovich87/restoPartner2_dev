/*
  # Sync courier payment with delivery price for performer zones

  1. Changes
    - Update all performer_delivery_zones records where courier_payment is 0
    - Set courier_payment = price_uah for these records

  2. Notes
    - This ensures existing zones have courier payment values
    - By default, courier payment should match the delivery price
*/

-- Sync courier_payment with price_uah for existing zones where courier_payment is 0
UPDATE performer_delivery_zones
SET courier_payment = price_uah
WHERE courier_payment = 0 OR courier_payment IS NULL;
