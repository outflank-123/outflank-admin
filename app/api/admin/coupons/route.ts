import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** GET /api/admin/coupons — list all coupons */
export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coupons: data })
}

/** POST /api/admin/coupons — create a coupon */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const {
    code, type, value, min_order_amount, max_discount_amount,
    usage_limit_total, usage_limit_per_user, is_active,
    expires_at, first_order_only, description,
  } = body

  if (!code || !type || value === undefined || value === null) {
    return NextResponse.json({ error: 'code, type, and value are required.' }, { status: 400 })
  }
  if (!['percentage', 'fixed'].includes(type)) {
    return NextResponse.json({ error: 'type must be "percentage" or "fixed".' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code: String(code).trim().toUpperCase(),
      type,
      value: Number(value),
      min_order_amount: Number(min_order_amount) || 0,
      max_discount_amount: max_discount_amount ? Number(max_discount_amount) : null,
      usage_limit_total: usage_limit_total !== '' && usage_limit_total !== null && usage_limit_total !== undefined ? Number(usage_limit_total) : null,
      usage_limit_per_user: Number(usage_limit_per_user) || 1,
      is_active: is_active !== false,
      expires_at: expires_at || null,
      first_order_only: Boolean(first_order_only),
      description: description || null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Coupon code already exists.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ coupon: data })
}
