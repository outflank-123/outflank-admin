-- ─────────────────────────────────────────────────────────────
-- WHATSAPP INTEGRATION & AUTOMATED NOTIFICATIONS SCHEMA
-- ─────────────────────────────────────────────────────────────

-- 1. Add WhatsApp settings columns to store_settings
ALTER TABLE public.store_settings 
  ADD COLUMN IF NOT EXISTS whatsapp_support_phone text DEFAULT '919999926273',
  ADD COLUMN IF NOT EXISTS whatsapp_admin_alerts_phone text DEFAULT '919999926273',
  ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_provider text DEFAULT 'meta_cloud',
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text DEFAULT null,
  ADD COLUMN IF NOT EXISTS whatsapp_business_account_id text DEFAULT null,
  ADD COLUMN IF NOT EXISTS whatsapp_access_token text DEFAULT null,
  ADD COLUMN IF NOT EXISTS whatsapp_templates jsonb DEFAULT '{"order_placed":"order_placed","order_shipped":"order_shipped","order_delivered":"order_delivered","admin_order_alert":"admin_order_alert","admin_lead_alert":"admin_lead_alert"}'::jsonb;

-- 2. Add whatsapp notification audit columns to retail_orders
ALTER TABLE public.retail_orders
  ADD COLUMN IF NOT EXISTS whatsapp_notified_placed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_notified_shipped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_notified_delivered boolean DEFAULT false;
