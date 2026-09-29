import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Webhook verification token — set this in your Meta App Dashboard
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'outflank_webhook_secret_2026';

// ── GET: Meta webhook verification handshake ──────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verification successful');
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ── POST: Receive inbound messages & delivery status updates ──────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) {
      return NextResponse.json({ status: 'no_value' });
    }

    // ── Handle inbound messages ─────────────────────────────────────────
    const messages = value.messages || [];
    for (const msg of messages) {
      const rawPhone    = msg.from;           // e.g. "918447334407"
      const wamid       = msg.id;
      const msgType     = msg.type;           // text | image | document | etc.
      const timestamp   = new Date(Number(msg.timestamp) * 1000).toISOString();

      // Extract body text
      let body = '';
      let mediaUrl = '';
      if (msgType === 'text') {
        body = msg.text?.body || '';
      } else if (msgType === 'image') {
        body = msg.image?.caption || '[Image]';
        mediaUrl = msg.image?.id || ''; // Meta media ID — can be fetched separately
      } else if (msgType === 'document') {
        body = msg.document?.filename || '[Document]';
      } else if (msgType === 'audio') {
        body = '[Voice Message]';
      } else if (msgType === 'video') {
        body = '[Video]';
      } else if (msgType === 'reaction') {
        body = `Reacted: ${msg.reaction?.emoji || '❤️'}`;
      } else {
        body = `[${msgType}]`;
      }

      // Get sender display name from contacts field
      const contacts = value.contacts || [];
      const contact  = contacts.find((c: any) => c.wa_id === rawPhone);
      const contactName = contact?.profile?.name || `+${rawPhone}`;

      // Upsert conversation
      const { data: conv, error: convErr } = await supabase
        .from('whatsapp_conversations')
        .upsert(
          {
            contact_phone:   rawPhone,
            contact_name:    contactName,
            last_message:    body,
            last_message_at: timestamp,
            unread_count:    1,    // will be incremented below via rpc or re-fetch
            status:          'open',
          },
          { onConflict: 'contact_phone', ignoreDuplicates: false }
        )
        .select('id, unread_count')
        .single();

      if (convErr) {
        console.error('[Webhook] Conversation upsert error:', convErr);
        continue;
      }

      // Increment unread_count
      await supabase
        .from('whatsapp_conversations')
        .update({
          unread_count:    (conv.unread_count || 0) + 1,
          last_message:    body,
          last_message_at: timestamp,
        })
        .eq('id', conv.id);

      // Insert message
      await supabase.from('whatsapp_messages').upsert(
        {
          conversation_id: conv.id,
          wamid,
          direction:       'inbound',
          message_type:    msgType,
          body,
          media_url:       mediaUrl || null,
          status:          'received',
          timestamp,
        },
        { onConflict: 'wamid', ignoreDuplicates: true }
      );
    }

    // ── Handle delivery status updates ──────────────────────────────────
    const statuses = value.statuses || [];
    for (const s of statuses) {
      const { id: wamid, status } = s;
      if (wamid && status) {
        await supabase
          .from('whatsapp_messages')
          .update({ status })
          .eq('wamid', wamid);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[Webhook] Error processing event:', err);
    // Always return 200 to Meta so they don't retry
    return NextResponse.json({ status: 'error', message: err.message }, { status: 200 });
  }
}
