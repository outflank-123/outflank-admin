import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const search = searchParams.get('search') || ''
  const tab = searchParams.get('tab') || 'all'
  const dateFilter = searchParams.get('dateFilter') || 'all_time'

  const supabase = await createClient()
  
  let query = supabase.from('retail_orders').select(`
    id, customer_name, customer_email, customer_phone, shipping_address,
    total_amount, payment_method, status, created_at, awb_number,
    dispatched_at, shadowfax_status, notes,
    retail_order_items (
      id, product_name, quantity, price_at_time, selected_color, customization,
      products ( primary_image_url )
    )
  `, { count: 'exact' })

  if (search) {
    query = query.or(`id.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%,awb_number.ilike.%${search}%`)
  }

  if (dateFilter !== 'all_time') {
    const now = new Date()
    if (dateFilter === 'today') {
      now.setHours(0,0,0,0)
      query = query.gte('created_at', now.toISOString())
    } else if (dateFilter === 'yesterday') {
      now.setHours(0,0,0,0)
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      query = query.gte('created_at', yesterday.toISOString()).lt('created_at', now.toISOString())
    } else if (dateFilter === 'last_7_days') {
      now.setDate(now.getDate() - 7)
      query = query.gte('created_at', now.toISOString())
    } else if (dateFilter === 'last_30_days') {
      now.setDate(now.getDate() - 30)
      query = query.gte('created_at', now.toISOString())
    }
  }

  if (tab === 'to_dispatch') {
    query = query.or('and(status.eq.pending,payment_method.eq.cod),status.eq.paid')
  } else if (tab === 'awaiting_payment') {
    query = query.eq('status', 'pending').neq('payment_method', 'cod')
  } else if (tab === 'shipped') {
    query = query.in('status', ['shipped', 'out_for_delivery'])
  } else if (tab === 'delivered') {
    query = query.eq('status', 'delivered')
  } else if (tab === 'failed_cancelled') {
    query = query.in('status', ['failed', 'cancelled'])
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ orders: data, total: count, page, limit })
}
