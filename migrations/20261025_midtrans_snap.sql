ALTER TABLE pesanan
  ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS pesanan_gateway_order_id_unique
  ON pesanan (gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;
