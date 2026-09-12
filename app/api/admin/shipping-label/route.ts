import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/admin/shipping-label?orderId=xxx
 * Returns a printable HTML shipping label for the order.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) return new NextResponse('Missing orderId', { status: 400 })

  const supabase = createAdminClient()
  const { data: order, error } = await supabase
    .from('retail_orders')
    .select('*, retail_order_items(product_name, quantity, price_at_time, selected_color)')
    .eq('id', orderId)
    .single()

  if (error || !order) return new NextResponse('Order not found', { status: 404 })

  let addr: any = order.shipping_address
  if (typeof addr === 'string') { try { addr = JSON.parse(addr) } catch {} }

  const itemsRows = (order.retail_order_items || []).map((item: any) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px;">${item.product_name}${item.selected_color ? ` (${item.selected_color})` : ''}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center;font-size:13px;">${item.quantity}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;font-size:13px;">₹${Number(item.price_at_time * item.quantity).toLocaleString('en-IN')}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Shipping Label - ${order.id.split('-')[0].toUpperCase()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
      .label-wrapper { box-shadow: none !important; }
    }
    .no-print {
      text-align: center;
      padding: 16px;
      background: #1d1d1f;
    }
    .no-print button {
      background: white;
      color: #1d1d1f;
      border: none;
      padding: 10px 28px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      margin: 0 6px;
    }
    .no-print button.outline {
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
    }
    .label-wrapper {
      max-width: 700px;
      margin: 20px auto;
      border: 2px solid #1d1d1f;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.12);
    }
    .header {
      background: #1d1d1f;
      color: white;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header .brand { font-size: 22px; font-weight: 900; letter-spacing: 2px; }
    .header .type { font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; opacity: 0.6; margin-top: 2px; }
    .header .order-id { text-align: right; }
    .header .order-id .label { font-size: 10px; opacity: 0.5; letter-spacing: 2px; text-transform: uppercase; }
    .header .order-id .value { font-size: 20px; font-weight: 900; font-family: monospace; }
    .awb-bar {
      background: #e3231c;
      color: white;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .awb-bar .awb-label { font-size: 10px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; opacity: 0.85; }
    .awb-bar .awb-value { font-size: 22px; font-weight: 900; font-family: monospace; letter-spacing: 2px; }
    .awb-bar .sfx { font-size: 11px; font-weight: 600; opacity: 0.7; margin-top: 2px; text-align: right;}
    .body { padding: 24px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
    .section-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #86868b;
      margin-bottom: 8px;
      border-bottom: 1px solid #f0f0f2;
      padding-bottom: 6px;
    }
    .address-block p { font-size: 14px; line-height: 1.7; color: #1d1d1f; }
    .address-block .name { font-size: 16px; font-weight: 700; }
    .address-block .phone { font-size: 14px; font-weight: 600; color: #e3231c; }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table th { font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #86868b; text-align: left; padding-bottom: 8px; border-bottom: 2px solid #1d1d1f; }
    .items-table th:nth-child(2) { text-align: center; }
    .items-table th:nth-child(3) { text-align: right; }
    .total-row { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; margin-top: 4px; border-top: 2px solid #1d1d1f; }
    .total-row .total-label { font-size: 13px; font-weight: 700; }
    .total-row .total-value { font-size: 18px; font-weight: 900; }
    .payment-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cod { background: #fff3e0; color: #e65100; }
    .prepaid { background: #e8f5e9; color: #1b5e20; }
    .footer {
      background: #f5f5f7;
      border-top: 1px dashed #d0d0d5;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer p { font-size: 11px; color: #86868b; }
    .barcode {
      font-family: monospace;
      font-size: 28px;
      letter-spacing: 4px;
      color: #1d1d1f;
      opacity: 0.15;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ Print Label</button>
    <button class="outline" onclick="window.close()">✕ Close</button>
  </div>
  <div class="label-wrapper">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand">OUTFLANK</div>
        <div class="type">Shipping Label</div>
      </div>
      <div class="order-id">
        <div class="label">Order ID</div>
        <div class="value">#${order.id.split('-')[0].toUpperCase()}</div>
      </div>
    </div>

    <!-- AWB Bar -->
    <div class="awb-bar">
      <div>
        <div class="awb-label">Shadowfax AWB Number</div>
        <div class="awb-value">${order.awb_number || 'NOT YET DISPATCHED'}</div>
      </div>
      <div class="sfx">
        <div>Powered by</div>
        <div style="font-size:14px;font-weight:900;">SHADOWFAX</div>
      </div>
    </div>

    <!-- Body -->
    <div class="body">
      <div class="row">
        <!-- Deliver To -->
        <div>
          <div class="section-title">📦 Deliver To</div>
          <div class="address-block">
            <p class="name">${order.customer_name}</p>
            <p class="phone">📞 ${order.customer_phone}</p>
            <p>${typeof addr === 'object' ? addr.addressLine1 || addr.address || '' : addr}</p>
            <p>${typeof addr === 'object' ? `${addr.city || ''}, ${addr.state || ''}` : ''}</p>
            <p style="font-weight:700;">PIN: ${typeof addr === 'object' ? addr.pincode || '' : ''}</p>
          </div>
        </div>
        <!-- Ship From -->
        <div>
          <div class="section-title">🏭 Ship From (Return Address)</div>
          <div class="address-block">
            <p class="name">Outflank Warehouse</p>
            <p>Delhi, India</p>
            <p>PIN: 110001</p>
            <p style="margin-top:12px;">
              <span class="payment-badge ${order.payment_method === 'cod' ? 'cod' : 'prepaid'}">
                ${order.payment_method === 'cod' ? '💵 Cash on Delivery' : '✅ Prepaid'}
              </span>
            </p>
            ${order.payment_method === 'cod' ? `<p style="margin-top:8px;font-size:13px;font-weight:700;color:#e65100;">Collect: ₹${Number(order.total_amount).toLocaleString('en-IN')}</p>` : ''}
          </div>
        </div>
      </div>

      <!-- Items -->
      <div class="section-title">🛍️ Order Contents</div>
      <table class="items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div class="total-row">
        <span class="total-label">Order Total</span>
        <span class="total-value">₹${Number(order.total_amount).toLocaleString('en-IN')}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Dispatched: ${order.dispatched_at ? new Date(order.dispatched_at).toLocaleString('en-IN') : 'Pending'} &nbsp;|&nbsp; Order Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      <div class="barcode">${order.awb_number || '— — — — —'}</div>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
