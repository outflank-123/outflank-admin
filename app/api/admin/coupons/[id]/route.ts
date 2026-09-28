import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** PATCH /api/admin/coupons/[id] — update a coupon */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await req.json()

  const allowedFields = [
    'code', 'type', 'value', 'min_order_amount', 'max_discount_amount',
    'usage_limit_total', 'usage_limit_per_user', 'is_active',
    'expires_at', 'first_order_only', 'description',
  ]

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const field of allowedFields) {
    if (field in body) {
      let v = body[field]
      if (field === 'code' && typeof v === 'string') v = v.trim().toUpperCase()
      if (['value', 'min_order_amount', 'max_discount_amount', 'usage_limit_per_user'].includes(field)) {
        v = v !== null && v !== '' ? Number(v) : null
      }
      if (field === 'usage_limit_total') {
        v = v !== null && v !== '' ? Number(v) : null
      }
      updates[field] = v
    }
  }

  const { data, error } = await supabase
    .from('coupons')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Coupon code already exists.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ coupon: data })
}

/** DELETE /api/admin/coupons/[id] — delete a coupon */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('coupons').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
