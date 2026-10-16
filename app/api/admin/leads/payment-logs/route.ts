import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/leads/payment-logs?lead_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lead_payment_logs')
    .select('*')
    .eq('lead_id', leadId)
    .order('payment_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data ?? [] })
}

// POST /api/admin/leads/payment-logs
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    lead_id,
    product_name,
    quantity,
    unit_price,
    total_amount,
    payment_type,
    payment_date,
    notes,
  } = body

  if (!lead_id || total_amount == null) {
    return NextResponse.json({ error: 'lead_id and total_amount are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lead_payment_logs')
    .insert({
      lead_id,
      product_name: product_name || null,
      quantity: quantity ? Number(quantity) : 1,
      unit_price: unit_price ? Number(unit_price) : 0,
      total_amount: Number(total_amount),
      payment_type: payment_type || 'advance',
      payment_date: payment_date || new Date().toISOString(),
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, log: data })
}

// DELETE /api/admin/leads/payment-logs?id=xxx
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('lead_payment_logs')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
