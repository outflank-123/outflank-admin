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

  const admin = createAdminClient()
  let query = admin
    .from('lead_payment_logs')
    .select('*')
    .order('payment_date', { ascending: false })

  if (leadId && leadId !== 'all') {
    query = query.eq('lead_id', leadId)
  }

  const { data, error } = await query
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
    amount,
    payment_type,
    payment_method,
    payment_date,
    notes,
  } = body

  const resolvedAmount = total_amount != null ? Number(total_amount) : (amount != null ? Number(amount) : null)

  if (!lead_id || resolvedAmount == null || isNaN(resolvedAmount) || resolvedAmount <= 0) {
    return NextResponse.json({ error: 'lead_id and a valid positive amount are required' }, { status: 400 })
  }

  // Combine payment method with notes if present
  let combinedNotes = notes?.trim() || ''
  if (payment_method && payment_method.trim()) {
    combinedNotes = combinedNotes ? `[${payment_method.trim()}] ${combinedNotes}` : `[${payment_method.trim()}]`
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lead_payment_logs')
    .insert({
      lead_id,
      product_name: product_name || null,
      quantity: quantity ? Number(quantity) : 1,
      unit_price: unit_price ? Number(unit_price) : 0,
      total_amount: resolvedAmount,
      payment_type: payment_type || 'advance',
      payment_date: payment_date || new Date().toISOString(),
      notes: combinedNotes || null,
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
