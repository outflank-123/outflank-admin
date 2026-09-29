import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin } from '@/lib/supabase/server';
import { getWhatsAppSettings } from '@/lib/services/whatsapp';

/**
 * POST /api/admin/whatsapp/reply
 * Supports sending text messages and image/document media messages.
 * Uploads files directly to WhatsApp Meta API and does not store them in Supabase.
 */
export async function POST(req: Request) {
  try {
    const { isAdmin, user } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const conversationId = formData.get('conversationId') as string | null;
    const to = formData.get('to') as string | null;
    const message = formData.get('message') as string | null;
    const messageType = (formData.get('messageType') as string) || 'text';
    const file = formData.get('file') as File | null;

    if (!to) {
      return NextResponse.json({ error: 'Recipient phone is required' }, { status: 400 });
    }

    // Require either message text or a file
    if (!message?.trim() && !file) {
      return NextResponse.json({ error: 'Message text or file is required' }, { status: 400 });
    }

    const settings = await getWhatsAppSettings();
    const phoneId = settings.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token   = settings.whatsapp_access_token    || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneId || !token) {
      return NextResponse.json({ error: 'WhatsApp API credentials not configured' }, { status: 500 });
    }

    let mediaId: string | null = null;

    // ── 1. Upload File directly to Meta (if attached) ──────────────────────
    if (file) {
      const metaForm = new FormData();
      metaForm.append('messaging_product', 'whatsapp');
      metaForm.append('file', file);

      const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: metaForm as any, // fetch handles FormData natively
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || uploadData.error) {
        console.error('[Reply API] Meta Upload error:', uploadData);
        return NextResponse.json(
          { error: uploadData.error?.message || 'Meta Media Upload failed' },
          { status: 400 }
        );
      }
      mediaId = uploadData.id;
    }

    // ── 2. Build Meta API payload for sending message ──────────────────────
    let metaPayload: Record<string, any> = {
      messaging_product: 'whatsapp',
      to,
    };

    if (mediaId && (messageType === 'image' || messageType === 'document' || messageType === 'video')) {
      metaPayload.type = messageType;
      metaPayload[messageType] = {
        id: mediaId,
        ...(message?.trim() && messageType === 'image' ? { caption: message.trim() } : {}),
        ...(messageType === 'document' ? { filename: file?.name || 'attachment' } : {}),
      };
    } else {
      // Plain text message
      metaPayload.type = 'text';
      metaPayload.text = { body: (message || '').trim() };
    }

    // ── 3. Call Meta API to send message ───────────────────────────────────
    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metaPayload),
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

    // ── 4. Save to DB (without media_url) ──────────────────────────────────
    const supabase = createAdminClient();
    let convId = conversationId;

    if (!convId || convId === 'null') {
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .upsert(
          {
            contact_phone:   to,
            contact_name:    to,
            last_message:    message?.trim() || `[${messageType}]`,
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

    const msgBody  = message?.trim() || null;
    const bodyText = mediaId ? (msgBody || `[${messageType}]`) : msgBody;

    if (convId) {
      await supabase.from('whatsapp_messages').insert({
        conversation_id: convId,
        wamid,
        direction:       'outbound',
        message_type:    mediaId ? messageType : 'text',
        body:            bodyText,
        media_url:       null, // Explicitly not saving to Supabase
        status:          'sent',
        sent_by:         user?.email || 'admin',
        timestamp:       new Date().toISOString(),
      });

      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message:    bodyText,
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
