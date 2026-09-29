import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin } from '@/lib/supabase/server';
import { getWhatsAppSettings } from '@/lib/services/whatsapp';

export async function POST(req: Request) {
  try {
    const { isAdmin, user } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, to, message } = await req.json();

    if (!to || !message?.trim()) {
      return NextResponse.json({ error: 'Recipient phone and message are required' }, { status: 400 });
    }

    const settings = await getWhatsAppSettings();
    const phoneId  = settings.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token    = settings.whatsapp_access_token    || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneId || !token) {
      return NextResponse.json({ error: 'WhatsApp API credentials not configured' }, { status: 500 });
    }

    // Send free-form text message via Meta API (only valid within 24hr customer-initiated window)
    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message.trim() },
        }),
      }
    );

    const metaData = await metaRes.json();

    if (!metaRes.ok || metaData.error) {
      console.error('[Reply API] Meta error:', metaData);
      return NextResponse.json(
        { error: metaData.error?.message || 'Meta API failed' },
        { status: 400 }
      );
    }

    const wamid = metaData.messages?.[0]?.id;

    // Save the outbound message to DB
    const supabase = createAdminClient();

    // Ensure conversation exists
    let convId = conversationId;
    if (!convId) {
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .upsert(
          {
            contact_phone:   to,
            contact_name:    to,
            last_message:    message.trim(),
            last_message_at: new Date().toISOString(),
            unread_count:    0,
            status:          'open',
          },
          { onConflict: 'contact_phone', ignoreDuplicates: false }
        )
        .select('id')
        .single();
      convId = conv?.id;
    }

    if (convId) {
      await supabase.from('whatsapp_messages').insert({
        conversation_id: convId,
        wamid,
        direction:       'outbound',
        message_type:    'text',
        body:            message.trim(),
        status:          'sent',
        sent_by:         user?.email || 'admin',
        timestamp:       new Date().toISOString(),
      });

      // Update conversation last message
      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message:    message.trim(),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', convId);
    }

    return NextResponse.json({ success: true, wamid, conversationId: convId });
  } catch (err: any) {
    console.error('[Reply API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
