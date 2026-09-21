import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage, formatWhatsAppPhone, getWhatsAppSettings } from '@/lib/services/whatsapp';
import { verifyAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch distinct phones from retail_orders
    const { data: orders } = await supabase
      .from('retail_orders')
      .select('customer_phone, customer_name')
      .not('customer_phone', 'is', null);

    // Fetch distinct phones from leads
    const { data: leads } = await supabase
      .from('leads')
      .select('phone, name, company')
      .not('phone', 'is', null);

    const orderPhones = new Set<string>();
    (orders || []).forEach((o) => {
      const formatted = formatWhatsAppPhone(o.customer_phone);
      if (formatted) orderPhones.add(formatted);
    });

    const leadPhones = new Set<string>();
    (leads || []).forEach((l) => {
      const formatted = formatWhatsAppPhone(l.phone);
      if (formatted) leadPhones.add(formatted);
    });

    const combinedPhones = new Set<string>([...orderPhones, ...leadPhones]);

    return NextResponse.json({
      retailCustomersCount: orderPhones.size,
      leadsCount: leadPhones.size,
      totalUniqueContacts: combinedPhones.size,
    });
  } catch (err: any) {
    console.error('[WhatsApp Broadcast API GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch audience counts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const body = await req.json();
    const {
      targetAudience, // 'retail_customers' | 'leads' | 'all' | 'custom'
      customNumbers, // string[]
      campaignTitle,
      messageText,
      templateName,
      mediaUrl,
      linkUrl,
      buttonText,
    } = body;

    if (!messageText?.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const settings = await getWhatsAppSettings();

    if (settings.whatsapp_provider === 'meta_cloud') {
      const phoneId = settings.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      const token = settings.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;
      if (!phoneId || !token) {
        return NextResponse.json(
          {
            error:
              'Meta Cloud API credentials are not configured. Please enter your Phone Number ID and Access Token in Store Settings first.',
          },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();
    const recipientMap = new Map<string, string>(); // phone -> name

    if (targetAudience === 'retail_customers' || targetAudience === 'all') {
      const { data: orders } = await supabase
        .from('retail_orders')
        .select('customer_phone, customer_name')
        .not('customer_phone', 'is', null);

      (orders || []).forEach((o) => {
        const formatted = formatWhatsAppPhone(o.customer_phone);
        if (formatted && !recipientMap.has(formatted)) {
          recipientMap.set(formatted, o.customer_name || 'Valued Customer');
        }
      });
    }

    if (targetAudience === 'leads' || targetAudience === 'all') {
      const { data: leads } = await supabase
        .from('leads')
        .select('phone, name')
        .not('phone', 'is', null);

      (leads || []).forEach((l) => {
        const formatted = formatWhatsAppPhone(l.phone);
        if (formatted && !recipientMap.has(formatted)) {
          recipientMap.set(formatted, l.name || 'Valued Partner');
        }
      });
    }

    if (targetAudience === 'custom' && Array.isArray(customNumbers)) {
      customNumbers.forEach((raw) => {
        const formatted = formatWhatsAppPhone(raw);
        if (formatted && !recipientMap.has(formatted)) {
          recipientMap.set(formatted, 'Valued Customer');
        }
      });
    }

    let recipients = Array.from(recipientMap.entries()).map(([phone, name]) => ({
      phone,
      name,
    }));

    // Filter by specific selected recipients if provided
    if (Array.isArray(body.selectedPhones) && body.selectedPhones.length > 0) {
      const allowedSet = new Set(body.selectedPhones.map((p: string) => formatWhatsAppPhone(p)).filter(Boolean));
      recipients = recipients.filter((r) => allowedSet.has(r.phone));
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients selected for broadcast' },
        { status: 400 }
      );
    }

    const results: Array<{
      phone: string;
      name: string;
      status: 'sent' | 'failed';
      error?: string;
      messageId?: string;
    }> = [];

    for (const recipient of recipients) {
      const personalizedText = messageText
        .replace(/{name}/gi, recipient.name)
        .replace(/{customer_name}/gi, recipient.name);

      const res = await sendWhatsAppMessage({
        to: recipient.phone,
        messageText: personalizedText,
        templateName: templateName || undefined,
        templateParams: [recipient.name],
        mediaUrl: mediaUrl || undefined,
        linkUrl: linkUrl || undefined,
        buttonText: buttonText || undefined,
      });

      if (res.success) {
        results.push({
          phone: recipient.phone,
          name: recipient.name,
          status: 'sent',
          messageId: res.messageId,
        });
      } else {
        results.push({
          phone: recipient.phone,
          name: recipient.name,
          status: 'failed',
          error: res.error,
        });
      }

      // 150ms polite delay
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const sentCount = results.filter((r) => r.status === 'sent').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      campaignTitle: campaignTitle || 'Broadcast Campaign',
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
      results,
    });
  } catch (err: any) {
    console.error('[WhatsApp Broadcast API POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
