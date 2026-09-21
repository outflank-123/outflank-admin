import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage, formatWhatsAppPhone, getWhatsAppSettings } from '@/lib/services/whatsapp';
import { verifyAdmin } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const body = await req.json();
    const { orderIds, templateType, customMessage, templateName } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one order to message' }, { status: 400 });
    }

    const settings = await getWhatsAppSettings();

    // Check credentials if using Meta Cloud API
    if (settings.whatsapp_provider === 'meta_cloud') {
      const phoneId = settings.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      const token = settings.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;
      if (!phoneId || !token) {
        return NextResponse.json(
          {
            error: 'Meta Cloud API credentials are not configured. Please enter your Phone Number ID and Access Token in Store Settings first.',
          },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();
    const { data: orders, error } = await supabase
      .from('retail_orders')
      .select('id, customer_name, customer_phone, total_amount, awb_number, status')
      .in('id', orderIds);

    if (error || !orders) {
      return NextResponse.json({ error: 'Failed to retrieve selected orders: ' + error?.message }, { status: 500 });
    }

    const results: Array<{
      orderId: string;
      customerName: string;
      phone: string;
      status: 'sent' | 'failed' | 'skipped';
      error?: string;
      messageId?: string;
    }> = [];

    for (const order of orders) {
      const rawPhone = order.customer_phone;
      const formatted = formatWhatsAppPhone(rawPhone);

      if (!formatted) {
        results.push({
          orderId: order.id,
          customerName: order.customer_name || 'Unknown',
          phone: rawPhone || 'Missing',
          status: 'skipped',
          error: 'Missing or invalid phone number',
        });
        continue;
      }

      const shortId = order.id.slice(0, 8).toUpperCase();
      const customerName = order.customer_name || 'Customer';
      const awb = order.awb_number || '';

      let messageText = '';
      let targetTemplate: string | undefined = templateName;
      let targetParams: string[] = [];

      if (templateType === 'tracking') {
        if (awb) {
          messageText = `Hi ${customerName}, your Outflank Order #${shortId} has been dispatched with Shadowfax! 📦\n\nTracking AWB: ${awb}\nTrack your shipment live: https://tracker.shadowfax.in/track?order_id=${awb}\n\nThank you for choosing Outflank!`;
          targetParams = [customerName, shortId, awb, `https://tracker.shadowfax.in/track?order_id=${awb}`];
        } else {
          messageText = `Hi ${customerName}, your Outflank Order #${shortId} is currently being packed at our facility. We will notify you with your live tracking link as soon as it departs!`;
          targetParams = [customerName, shortId];
        }
      } else if (templateType === 'artwork') {
        messageText = `Hi ${customerName}, regarding your custom printed merchandise Order #${shortId}: Could you please share your brand logo / design file in high-resolution vector (AI/SVG/EPS) or transparent PNG format directly on this chat so our design team can prepare your mockup?`;
        targetParams = [customerName, shortId];
      } else if (templateType === 'invoice') {
        messageText = `Hi ${customerName}, thank you for ordering with Outflank! Here is the order summary for Order #${shortId} (Total: ₹${order.total_amount?.toLocaleString('en-IN')}). If you need a formal GST tax invoice, we'd be delighted to assist you!`;
        targetParams = [customerName, shortId, `₹${order.total_amount?.toLocaleString('en-IN')}`];
      } else {
        // Custom message with dynamic interpolation
        const baseMsg = customMessage || 'Thank you for choosing Outflank!';
        messageText = baseMsg
          .replace(/{customer_name}/gi, customerName)
          .replace(/{order_id}/gi, shortId)
          .replace(/{total}/gi, `₹${order.total_amount?.toLocaleString('en-IN') || 0}`)
          .replace(/{awb}/gi, awb || 'N/A');
        targetParams = [customerName, shortId];
      }

      // Dispatch via WhatsApp service
      const res = await sendWhatsAppMessage({
        to: formatted,
        messageText,
        templateName: targetTemplate,
        templateParams: targetParams,
      });

      if (res.success) {
        results.push({
          orderId: order.id,
          customerName,
          phone: formatted,
          status: 'sent',
          messageId: res.messageId,
        });
      } else {
        results.push({
          orderId: order.id,
          customerName,
          phone: formatted,
          status: 'failed',
          error: res.error,
        });
      }

      // Polite delay between outbound messages (150ms) to respect Meta rate-limits
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const sentCount = results.filter((r) => r.status === 'sent').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;

    return NextResponse.json({
      success: true,
      total: orders.length,
      sentCount,
      failedCount,
      skippedCount,
      results,
    });
  } catch (err: any) {
    console.error('[Bulk WhatsApp API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
