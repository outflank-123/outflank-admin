import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: messages, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ messages: messages || [] });
  } catch (err: any) {
    console.error('[Messages API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
