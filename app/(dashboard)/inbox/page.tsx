import { createAdminClient } from '@/lib/supabase/admin';
import InboxClient from './InboxClient';

export const revalidate = 0;

export default async function InboxPage() {
  const supabase = createAdminClient();

  // Fetch conversations ordered by latest message
  const { data: conversations } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .order('last_message_at', { ascending: false });

  return <InboxClient initialConversations={conversations || []} />;
}
