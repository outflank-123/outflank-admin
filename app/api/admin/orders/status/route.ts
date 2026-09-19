import { NextResponse } from 'next/server'
import { createClient, verifyAdmin } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json()

    if (!orderId || !status) {
      return NextResponse.json({ error: 'Missing orderId or status' }, { status: 400 })
    }

    const supabase = await createClient()

    // Auth Check: Must be Admin
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError }, { status: 403 })
    }

    const allowedStatuses = ['pending', 'paid', 'failed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }

    // Fetch current order status to enforce state machine direction
    const { data: orderData, error: fetchError } = await supabase
      .from('retail_orders')
      .select('status')
      .eq('id', orderId)
      .single()
      
    if (fetchError || !orderData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const statusHierarchy: Record<string, number> = {
      'cancelled': -1,
      'failed': -1,
      'pending': 0,
      'paid': 1,
      'shipped': 2,
      'out_for_delivery': 3,
      'delivered': 4
    }

    const currentIndex = statusHierarchy[orderData.status] ?? 0
    const newIndex = statusHierarchy[status] ?? 0

    // Prevent backwards movement in the state machine (unless cancelling/failing)
    if (newIndex >= 0 && currentIndex >= 0 && newIndex < currentIndex) {
      return NextResponse.json({ 
        error: `Cannot move order backwards from '${orderData.status}' to '${status}'.` 
      }, { status: 400 })
    }

    const updatePayload: any = { status }
    if (status === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString()
    }

    let { error } = await supabase
      .from('retail_orders')
      .update(updatePayload)
      .eq('id', orderId)

    if (error && error.code === '42703' && updatePayload.delivered_at) {
      delete updatePayload.delivered_at
      const retry = await supabase
        .from('retail_orders')
        .update(updatePayload)
        .eq('id', orderId)
      error = retry.error
    }

    if (error) {
      console.error('Error updating order status:', error)
      return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API Error updating order status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
