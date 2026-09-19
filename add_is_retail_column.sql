-- ─────────────────────────────────────────────────────────────
-- Migration: Add is_retail column to products table
-- ─────────────────────────────────────────────────────────────
-- Enables admin to specify whether a product is available for
-- single-unit B2C retail checkout or restricted to B2B bulk orders.

-- 1. Add is_retail column (default true for backward compatibility with existing products)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_retail boolean NOT NULL DEFAULT true;

-- 2. Create index for fast catalog filtering (retail vs bulk)
CREATE INDEX IF NOT EXISTS products_is_retail_idx
  ON public.products (is_retail);

-- 3. Add column documentation
COMMENT ON COLUMN public.products.is_retail IS
  'True if product can be purchased via retail cart/checkout. False if reserved exclusively for bulk B2B wholesale inquiries.';
