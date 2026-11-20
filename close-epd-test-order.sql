-- One-time recovery for the known Cloudflare redirect:'error' pre-request failure.
-- Owner reported no EPD transactions for this attempt.
-- This closes ONLY the matching uncharged order. It does not delete orders,
-- increase physical stock, refund, contact EPD, or submit a payment.
-- Keep checkout paused and deploy the EPD request fix before retrying checkout.

UPDATE orders
SET status = 'failed',
    error_code = 'EPD_PREFLIGHT_NOT_SENT',
    recovery_note = 'Closed known Cloudflare request-construction failure after owner checked EPD: no transaction.',
    payment_request = NULL,
    updated_at = unixepoch()
WHERE id = '311d0d9c-7d91-4885-820a-f6f4f5c2ee99'
  AND status = 'processing'
  AND payment_provider = 'epd'
  AND payment_environment = 'live'
  AND payment_id IS NULL
  AND payment_attempted = 1
  AND inventory_committed = 0
  AND json_extract(data, '$.totals.total') = 554
  AND json_array_length(data, '$.lines') = 1
  AND json_extract(data, '$.lines[0].slug') = 'honey-lavender-lip-balm'
  AND json_extract(data, '$.lines[0].quantity') = 1;

UPDATE quotes
SET status = 'closed'
WHERE id IN (
  SELECT quote_id FROM orders
  WHERE id = '311d0d9c-7d91-4885-820a-f6f4f5c2ee99'
    AND status = 'failed'
    AND error_code = 'EPD_PREFLIGHT_NOT_SENT'
    AND payment_id IS NULL
    AND inventory_committed = 0
);

DELETE FROM reservations
WHERE order_id = '311d0d9c-7d91-4885-820a-f6f4f5c2ee99'
  AND EXISTS (
    SELECT 1 FROM orders
    WHERE id = reservations.order_id
      AND status = 'failed'
      AND error_code = 'EPD_PREFLIGHT_NOT_SENT'
      AND payment_id IS NULL
      AND inventory_committed = 0
  );

SELECT id, status, error_code, payment_id, inventory_committed,
       (SELECT COUNT(*) FROM reservations WHERE order_id = orders.id) AS reservations_remaining
FROM orders
WHERE id = '311d0d9c-7d91-4885-820a-f6f4f5c2ee99';
