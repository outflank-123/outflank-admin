-- ─────────────────────────────────────────────────────────────────────────────
-- OUTFLANK: LEAD PIPELINE UPGRADE + PAYMENT LOGS + DEMO DATA
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ENSURE REQUIRED COLUMNS EXIST ON LEADS TABLE
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source text DEFAULT 'website';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deal_value numeric(12, 2) DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS order_items jsonb DEFAULT '[]'::jsonb;

-- 2. CONVERT 'status' COLUMN TO TEXT
-- Converting to text removes all Postgres enum transaction locks, 55P04 errors,
-- and 22023 rename errors. It gives full freedom for any pipeline stage!
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'leads' 
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.leads ALTER COLUMN status TYPE text USING status::text;
    ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'conversation';
  END IF;
END $$;

-- 3. MIGRATE ANY EXISTING LEADS TO THE NEW 6-STAGE NAMES
UPDATE public.leads SET status = 'conversation'     WHERE status = 'new';
UPDATE public.leads SET status = 'sampling'         WHERE status = 'contacted';
UPDATE public.leads SET status = 'finalise'         WHERE status = 'qualified';
UPDATE public.leads SET status = 'delivered'        WHERE status = 'closed';

-- 4. SAFELY UPDATE lead_status ENUM IF IT EXISTS (Non-blocking, won't error)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'lead_status' AND e.enumlabel = 'new') THEN
    ALTER TYPE lead_status RENAME VALUE 'new' TO 'conversation';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'lead_status' AND e.enumlabel = 'contacted') THEN
    ALTER TYPE lead_status RENAME VALUE 'contacted' TO 'sampling';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'lead_status' AND e.enumlabel = 'qualified') THEN
    ALTER TYPE lead_status RENAME VALUE 'qualified' TO 'finalise';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'lead_status' AND e.enumlabel = 'closed') THEN
    ALTER TYPE lead_status RENAME VALUE 'closed' TO 'delivered';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'advance_received';
  ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'close_deal';
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 5. CREATE lead_payment_logs TABLE
CREATE TABLE IF NOT EXISTS public.lead_payment_logs (
  id             uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id        uuid            NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  product_name   text,
  quantity       integer         DEFAULT 1,
  unit_price     numeric(12, 2)  DEFAULT 0,
  total_amount   numeric(12, 2)  NOT NULL DEFAULT 0,
  payment_type   text            DEFAULT 'advance',   -- advance | partial | final
  payment_date   timestamptz     DEFAULT now(),
  notes          text,
  created_at     timestamptz     DEFAULT now()
);

-- 6. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_lead_payment_logs_lead_id
  ON public.lead_payment_logs (lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_payment_logs_created_at
  ON public.lead_payment_logs (created_at DESC);

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.lead_payment_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_payment_logs'
      AND policyname = 'Admin full access to lead_payment_logs'
  ) THEN
    CREATE POLICY "Admin full access to lead_payment_logs"
      ON public.lead_payment_logs
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 8. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- 9. SEED DEMO DATA (One lead per pipeline stage, one per source)
-- Safe re-run: Uses WHERE NOT EXISTS so it will never duplicate or fail on constraint issues
INSERT INTO public.leads (name, company, email, phone, product_name, requirements, status, source, notes, deal_value, order_items, created_at, updated_at)
SELECT v.name, v.company, v.email, v.phone, v.product_name, v.requirements, v.status, v.source, v.notes, v.deal_value, v.order_items::jsonb, v.created_at, v.updated_at
FROM (
  VALUES
    -- 1. Conversation | Website
    (
      'Rajesh Kumar', 'TechCorp India Pvt Ltd', 'rajesh.kumar@techcorp.in', '+91 98765 43210',
      '250x Custom Bio-Washed Polos',
      'Company logo embroidered on chest, navy blue colour, sizes S to XL. Need delivery before Diwali.',
      'conversation', 'website', NULL::text,
      100000.00,
      '[{"id":"item_1","name":"Custom Bio-Washed Polos","quality":"240 GSM 100% Combed Cotton, Navy Blue, Embroidered Chest Logo","quantity":250,"unit_price":400,"total":100000}]',
      now() - interval '3 days', now() - interval '3 days'
    ),

    -- 2. Sampling | Facebook
    (
      'Priya Sharma', 'Infosys Technologies Ltd', 'priya.sharma@infosys.com', '+91 91234 56789',
      '500x Fleece Zip-Up Hoodies',
      'Grey hoodies with white screen print logo on chest, multiple sizes, for annual offsite.',
      'sampling', 'facebook', 'Sample kit dispatched 14 Oct. Client liked the GSM. Waiting for colour confirmation.',
      375000.00,
      '[{"id":"item_1","name":"Fleece Zip-Up Hoodies","quality":"320 GSM Heavyweight Poly-Cotton Fleece, Heather Grey, Screen Printed","quantity":500,"unit_price":750,"total":375000}]',
      now() - interval '8 days', now() - interval '2 days'
    ),

    -- 3. Finalise | IndiaMart
    (
      'Amit Patel', 'Reliance Fresh Retail', 'amit.patel@reliancefresh.com', '+91 87654 32109',
      '1000x Printed Cotton Tote Bags',
      'White tote bags, 120 GSM, full-colour logo, loop handles, 14x16 inch. Diwali gifting campaign.',
      'finalise', 'indiamart', 'Quotation shared at ₹180/bag. Negotiating quantity. Procurement approval pending.',
      180000.00,
      '[{"id":"item_1","name":"Printed Cotton Tote Bags","quality":"120 GSM Natural Cotton Canvas, 14x16 inch, Loop Handles, Full Colour Logo","quantity":1000,"unit_price":180,"total":180000}]',
      now() - interval '15 days', now() - interval '1 day'
    ),

    -- 4. Advance Received | Reference
    (
      'Sunita Verma', 'HDFC Bank Ltd', 'sunita.verma@hdfc.com', '+91 76543 21098',
      '750x Premium Drinkware Gift Set',
      'Stainless steel bottle + ceramic mug combo in custom gift box. Corporate Q3 gifting.',
      'advance_received', 'reference', 'Advance ₹1,50,000 received via NEFT on 10 Oct. Production started. Dispatch in 10 days.',
      375000.00,
      '[{"id":"item_1","name":"Premium Drinkware Gift Set","quality":"SS 304 750ml Vacuum Insulated Bottle + Ceramic Mug in Luxury Matte Box","quantity":750,"unit_price":500,"total":375000}]',
      now() - interval '20 days', now() - interval '7 days'
    ),

    -- 5. Close Deal | Direct
    (
      'Vikram Singh', 'Tata Motors Ltd', 'vikram.singh@tatamotors.com', '+91 65432 10987',
      '300x Branded Laptop Bags',
      'Black nylon laptop bags, 15.6 inch, company embroidered patch on front, padded back strap.',
      'close_deal', 'direct', 'Deal closed at ₹3,45,000. Full payment received. Final production sign-off done. Ready to dispatch.',
      345000.00,
      '[{"id":"item_1","name":"Branded Executive Laptop Bags","quality":"1680D Ballistic Nylon, 15.6 inch Padded Compartment, Metal Logo Pullers","quantity":300,"unit_price":1150,"total":345000}]',
      now() - interval '28 days', now() - interval '4 days'
    ),

    -- 6. Delivered | WhatsApp
    (
      'Neha Agarwal', 'Amazon India Pvt Ltd', 'neha.agarwal@amazon.in', '+91 54321 09876',
      '2000x Custom Black Round-Neck Tees',
      '100% cotton, screen print on back with event branding, sizes S/M/L/XL/XXL in equal split.',
      'delivered', 'whatsapp', 'Full order delivered 8 Oct. Client confirmed receipt and quality. ⭐ Potential repeat order for Dec.',
      700000.00,
      '[{"id":"item_1","name":"Custom Black Round-Neck Tees","quality":"180 GSM Super-Combed 100% Cotton, Bio-Washed, Discharge Screen Print","quantity":2000,"unit_price":350,"total":700000}]',
      now() - interval '40 days', now() - interval '10 days'
    )
) AS v(name, company, email, phone, product_name, requirements, status, source, notes, deal_value, order_items, created_at, updated_at)
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads WHERE public.leads.email = v.email
);

-- 9B. UPDATE EXISTING DEMO LEADS IF THEY WERE ALREADY INSERTED WITHOUT ORDER ITEMS
UPDATE public.leads
SET
  deal_value = 100000.00,
  order_items = '[{"id":"item_1","name":"Custom Bio-Washed Polos","quality":"240 GSM 100% Combed Cotton, Navy Blue, Embroidered Chest Logo","quantity":250,"unit_price":400,"total":100000}]'::jsonb
WHERE email = 'rajesh.kumar@techcorp.in' AND (order_items IS NULL OR order_items = '[]'::jsonb OR deal_value = 0);

UPDATE public.leads
SET
  deal_value = 375000.00,
  order_items = '[{"id":"item_1","name":"Fleece Zip-Up Hoodies","quality":"320 GSM Heavyweight Poly-Cotton Fleece, Heather Grey, Screen Printed","quantity":500,"unit_price":750,"total":375000}]'::jsonb
WHERE email = 'priya.sharma@infosys.com' AND (order_items IS NULL OR order_items = '[]'::jsonb OR deal_value = 0);

UPDATE public.leads
SET
  deal_value = 180000.00,
  order_items = '[{"id":"item_1","name":"Printed Cotton Tote Bags","quality":"120 GSM Natural Cotton Canvas, 14x16 inch, Loop Handles, Full Colour Logo","quantity":1000,"unit_price":180,"total":180000}]'::jsonb
WHERE email = 'amit.patel@reliancefresh.com' AND (order_items IS NULL OR order_items = '[]'::jsonb OR deal_value = 0);

UPDATE public.leads
SET
  deal_value = 375000.00,
  order_items = '[{"id":"item_1","name":"Premium Drinkware Gift Set","quality":"SS 304 750ml Vacuum Insulated Bottle + Ceramic Mug in Luxury Matte Box","quantity":750,"unit_price":500,"total":375000}]'::jsonb
WHERE email = 'sunita.verma@hdfc.com' AND (order_items IS NULL OR order_items = '[]'::jsonb OR deal_value = 0);

UPDATE public.leads
SET
  deal_value = 345000.00,
  order_items = '[{"id":"item_1","name":"Branded Executive Laptop Bags","quality":"1680D Ballistic Nylon, 15.6 inch Padded Compartment, Metal Logo Pullers","quantity":300,"unit_price":1150,"total":345000}]'::jsonb
WHERE email = 'vikram.singh@tatamotors.com' AND (order_items IS NULL OR order_items = '[]'::jsonb OR deal_value = 0);

UPDATE public.leads
SET
  deal_value = 700000.00,
  order_items = '[{"id":"item_1","name":"Custom Black Round-Neck Tees","quality":"180 GSM Super-Combed 100% Cotton, Bio-Washed, Discharge Screen Print","quantity":2000,"unit_price":350,"total":700000}]'::jsonb
WHERE email = 'neha.agarwal@amazon.in' AND (order_items IS NULL OR order_items = '[]'::jsonb OR deal_value = 0);

-- 10. SEED PAYMENT LOGS (For leads where payments occurred)
-- Safe re-run: Only inserts if no payment logs exist for that lead yet
INSERT INTO public.lead_payment_logs
  (lead_id, product_name, quantity, unit_price, total_amount, payment_type, payment_date, notes)
SELECT v.lead_id, v.product_name, v.quantity, v.unit_price, v.total_amount, v.payment_type, v.payment_date, v.notes
FROM (
  VALUES
    -- HDFC Bank (advance_received)
    (
      (SELECT id FROM public.leads WHERE email = 'sunita.verma@hdfc.com' LIMIT 1),
      '750x Premium Drinkware Gift Set',
      750, 200.00, 150000.00,
      'advance',
      now() - interval '7 days',
      'Advance received via NEFT. Ref: HDFC20241010ABX. Production kicked off.'
    ),
    -- Tata Motors (close_deal) - 1. Advance
    (
      (SELECT id FROM public.leads WHERE email = 'vikram.singh@tatamotors.com' LIMIT 1),
      '300x Branded Laptop Bags',
      300, 575.00, 172500.00,
      'advance',
      now() - interval '18 days',
      '50% advance tranche 1. NEFT from Tata Motors treasury account.'
    ),
    -- Tata Motors (close_deal) - 2. Final
    (
      (SELECT id FROM public.leads WHERE email = 'vikram.singh@tatamotors.com' LIMIT 1),
      '300x Branded Laptop Bags',
      300, 575.00, 172500.00,
      'final',
      now() - interval '5 days',
      'Final 50% balance cleared on dispatch. Total: ₹3,45,000.'
    ),
    -- Amazon India (delivered) - 1. Advance
    (
      (SELECT id FROM public.leads WHERE email = 'neha.agarwal@amazon.in' LIMIT 1),
      '2000x Custom Black Tees',
      2000, 350.00, 350000.00,
      'advance',
      now() - interval '32 days',
      '50% advance to start production. UPI transfer from Amazon vendor account.'
    ),
    -- Amazon India (delivered) - 2. Partial
    (
      (SELECT id FROM public.leads WHERE email = 'neha.agarwal@amazon.in' LIMIT 1),
      '2000x Custom Black Tees',
      2000, 350.00, 175000.00,
      'partial',
      now() - interval '18 days',
      '25% interim payment on sampling approval. NEFT received.'
    ),
    -- Amazon India (delivered) - 3. Final
    (
      (SELECT id FROM public.leads WHERE email = 'neha.agarwal@amazon.in' LIMIT 1),
      '2000x Custom Black Tees',
      2000, 350.00, 175000.00,
      'final',
      now() - interval '10 days',
      'Final 25% cleared on delivery. Full ₹7,00,000 received. Order complete ✅'
    )
) AS v(lead_id, product_name, quantity, unit_price, total_amount, payment_type, payment_date, notes)
WHERE v.lead_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_payment_logs lpl
    WHERE lpl.lead_id = v.lead_id
  );
