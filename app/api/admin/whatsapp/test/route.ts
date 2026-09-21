import { NextResponse } from 'next/server';
import { sendWhatsAppMessage, formatWhatsAppPhone } from '@/lib/services/whatsapp';
import { verifyAdmin } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const body = await req.json();
    const to = body.to || body.toPhone;
    const message = body.message || body.customText;
    const { mediaUrl, linkUrl, buttonText } = body;

    if (!to) {
      return NextResponse.json({ error: 'Recipient phone number is required' }, { status: 400 });
    }

    const formattedPhone = formatWhatsAppPhone(to);
    if (!formattedPhone) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    const text = message || 'Hello from Outflank! Your WhatsApp Business API integration is connected and working successfully.';

    const result = await sendWhatsAppMessage({
      to: formattedPhone,
      messageText: text,
      mediaUrl: mediaUrl || undefined,
      linkUrl: linkUrl || undefined,
      buttonText: buttonText || undefined,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to dispatch WhatsApp message',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Test message successfully queued for ${formattedPhone}!`,
    });
  } catch (error: any) {
    console.error('[WhatsApp Test API] Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal error testing WhatsApp' }, { status: 500 });
  }
}
