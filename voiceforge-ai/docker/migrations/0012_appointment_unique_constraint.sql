-- 0012: Add unique constraint to prevent double-booking
-- UNIQUE(customer_id, scheduled_at) — one slot per customer per timestamp

-- Remove any existing duplicates (keep the most recent by created_at)
DELETE FROM appointments a
USING appointments b
WHERE a.customer_id = b.customer_id
  AND a.scheduled_at = b.scheduled_at
  AND a.created_at < b.created_at;

ALTER TABLE appointments
  ADD CONSTRAINT uq_appointments_customer_time
  UNIQUE (customer_id, scheduled_at);
