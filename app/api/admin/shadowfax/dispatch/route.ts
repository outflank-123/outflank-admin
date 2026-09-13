import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SHADOWFAX_BASE_URL = process.env.SHADOWFAX_BASE_URL || 'https://dale.staging.shadowfax.in/api'
const SHADOWFAX_API_TOKEN = process.env.SHADOWFAX_API_TOKEN || ''

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sfxHeaders() {
  return {
    'Authorization': `Token ${SHADOWFAX_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

/**
 * POST /api/admin/shadowfax/dispatch
 *
 * Called from the Admin Panel when dispatching a paid order via Shadowfax.
 * 
 * Body: { orderId, weightKg? }
 */
export async function POST(req: NextRequest) {
  try {
    const { orderId, weightKg = 0.5 } = await req.json()

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    // Fetch the full order from Supabase
    const { data: order, error: fetchError } = await supabase
      .from('retail_orders')
      .select('*, retail_order_items(product_name, quantity)')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.awb_number) {
      return NextResponse.json({ error: 'Order already dispatched', awb_number: order.awb_number }, { status: 409 })
    }

    // Parse the shipping address (stored as JSON string or object)
    let addr: any = order.shipping_address
    if (typeof addr === 'string') {
      try { 
        addr = JSON.parse(addr) 
      } catch {
        const match = addr.match(/-?\\s*(\\d{6})$/)
        const pincode = match ? match[1] : '110001'
        addr = { addressLine1: addr, city: 'Unknown', state: 'Unknown', pincode }
      }
    }

    const productSummary = order.retail_order_items
      ?.map((i: any) => `${i.product_name} x${i.quantity}`)
      .join(', ') || 'Outflank Product'

    // Build Shadowfax warehouse model payload
    const sfxBody = {
      order_details: {
        client_order_id: orderId,
        payment_mode: order.payment_method === 'cod' ? 'cod' : 'prepaid',
        cod_amount: order.payment_method === 'cod' ? Number(order.total_amount) : 0,
        product_value: Number(order.total_amount),
      },
      customer_details: {
        name: order.customer_name,
        contact: order.customer_phone,
        address_line_1: addr?.addressLine1 || addr?.address || (typeof addr === 'string' ? addr : 'N/A'),
        city: addr?.city || 'Delhi',
        state: addr?.state || 'Delhi',
        pincode: String(addr?.pincode || '110001'),
      },
      pickup_details: {
        name: 'Outflank Warehouse',
        contact: '9999999999',
        address_line_1: 'Outflank Warehouse, Delhi',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
      },
      return_details: {
        return_type: 'origin',
        name: 'Outflank Warehouse',
        contact: '9999999999',
        address_line_1: 'Outflank Warehouse, Delhi',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
      },
      product_details: [{
        name: productSummary,
        quantity: 1,
        price: Number(order.total_amount),
        weight: weightKg,
      }]
    }

    console.log('[Shadowfax Dispatch] Sending to Shadowfax:', JSON.stringify(sfxBody, null, 2))

    // Call Shadowfax API
    const sfxRes = await fetch(`${SHADOWFAX_BASE_URL}/v3/clients/orders/`, {
      method: 'POST',
      headers: sfxHeaders(),
      body: JSON.stringify(sfxBody),
    })

    const sfxData = await sfxRes.json()
    console.log('[Shadowfax Dispatch] Response:', JSON.stringify(sfxData, null, 2))

    if (!sfxRes.ok) {
      return NextResponse.json(
        { error: sfxData?.message || 'Shadowfax API error', details: sfxData },
        { status: sfxRes.status }
      )
    }

    const awbNumber = sfxData?.awb_number || sfxData?.data?.awb_number

    // Save AWB number and update order status to 'shipped'
    const { error: updateError } = await supabase
      .from('retail_orders')
      .update({
        awb_number: awbNumber,
        shadowfax_order_id: orderId,
        shadowfax_status: 'new',
        status: 'shipped',
        dispatched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('[Shadowfax Dispatch] Supabase update error:', updateError)
      return NextResponse.json({ error: 'Order dispatched but DB update failed', awb_number: awbNumber }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      awb_number: awbNumber,
      message: `Order dispatched successfully. AWB: ${awbNumber}`,
    })
  } catch (err) {
    console.error('[Shadowfax Dispatch] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
