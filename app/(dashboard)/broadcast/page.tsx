import { createAdminClient } from '@/lib/supabase/admin';
import BroadcastPageClient, { BroadcastContact } from './BroadcastPageClient';

export const revalidate = 60;

export default async function BroadcastPage() {
  const supabase = createAdminClient();

  // 1. Fetch registered customers from customers table
  let customers: any[] = [];
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, firebase_uid, full_name, email, phone, auth_provider, shipping_address, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) {
      customers = data;
    }
  } catch (err) {
    console.warn('[Broadcast] Error loading registered customers:', err);
  }

  // 2. Fetch retail orders
  const { data: orders } = await supabase
    .from('retail_orders')
    .select('id, customer_phone, customer_name, total_amount, status, notes, created_at')
    .not('customer_phone', 'is', null)
    .order('created_at', { ascending: false });

  // 3. Fetch corporate leads
  const { data: leads } = await supabase
    .from('leads')
    .select('id, phone, name, company, product_name, status, requirements, created_at')
    .not('phone', 'is', null)
    .order('created_at', { ascending: false });

  const contactsMap = new Map<string, BroadcastContact>();

  // Process registered customers first
  (customers || []).forEach((c) => {
    const raw = (c.phone || c.shipping_address?.phone || '').replace(/\D/g, '');
    if (!raw) return;
    const formatted = raw.length === 10 ? `91${raw}` : raw;

    const providerName = c.auth_provider === 'whatsapp' ? 'WhatsApp Verified' : c.auth_provider === 'apple' ? 'Apple Account' : 'Google Account';

    contactsMap.set(formatted, {
      id: c.id || c.firebase_uid,
      phone: formatted,
      name: c.full_name || c.shipping_address?.fullName || 'Registered Customer',
      source: 'customer',
      meta: `${providerName}${c.email ? ' • ' + c.email : ''}`,
      date: c.created_at,
      totalSpent: 0,
      ordersCount: 0,
      status: 'active',
      company: c.shipping_address?.companyName || undefined,
      email: c.email || undefined,
      authProvider: c.auth_provider || undefined,
    });
  });

  // Process retail orders with spend & order aggregation
  (orders || []).forEach((o) => {
    const raw = (o.customer_phone || '').replace(/\D/g, '');
    if (!raw) return;
    const formatted = raw.length === 10 ? `91${raw}` : raw;

    let hasCustom = false;
    if (o.notes) {
      try {
        const parsed = typeof o.notes === 'string' ? JSON.parse(o.notes) : o.notes;
        hasCustom = Boolean(parsed?.custom_items?.length || parsed?.customization);
      } catch {
        hasCustom = String(o.notes).toLowerCase().includes('custom') || String(o.notes).toLowerCase().includes('logo');
      }
    }

    const amount = Number(o.total_amount) || 0;

    if (!contactsMap.has(formatted)) {
      contactsMap.set(formatted, {
        id: o.id,
        phone: formatted,
        name: o.customer_name || 'Retail Customer',
        source: 'retail',
        meta: `Order #${o.id.slice(0, 8).toUpperCase()} (₹${amount.toLocaleString('en-IN')})`,
        date: o.created_at,
        totalSpent: amount,
        ordersCount: 1,
        status: o.status || 'paid',
        hasCustomPrint: hasCustom,
      });
    } else {
      const existing = contactsMap.get(formatted)!;
      existing.totalSpent = (existing.totalSpent || 0) + amount;
      existing.ordersCount = (existing.ordersCount || 0) + 1;
      if (hasCustom) existing.hasCustomPrint = true;
      if (o.customer_name && existing.name === 'Registered Customer') {
        existing.name = o.customer_name;
      }
      existing.meta = `${existing.name} • ${existing.ordersCount} Orders (₹${existing.totalSpent.toLocaleString('en-IN')})`;
    }
  });

  // Process corporate leads
  (leads || []).forEach((l) => {
    const raw = (l.phone || '').replace(/\D/g, '');
    if (!raw) return;
    const formatted = raw.length === 10 ? `91${raw}` : raw;
    if (!contactsMap.has(formatted)) {
      const hasCustom = Boolean(
        l.product_name?.toLowerCase().includes('polo') ||
        l.product_name?.toLowerCase().includes('custom') ||
        l.requirements?.toLowerCase().includes('logo') ||
        l.requirements?.toLowerCase().includes('embroidery')
      );

      contactsMap.set(formatted, {
        id: l.id,
        phone: formatted,
        name: l.name || 'Corporate Lead',
        source: 'lead',
        meta: l.company
          ? `${l.company}${l.product_name ? ' • ' + l.product_name : ''}`
          : l.product_name || 'Corporate Inquiry',
        date: l.created_at,
        totalSpent: 0,
        ordersCount: 0,
        status: l.status || 'new',
        company: l.company || undefined,
        hasCustomPrint: hasCustom,
      });
    }
  });

  const contacts = Array.from(contactsMap.values());
  const registeredCount = contacts.filter((c) => c.source === 'customer' || Boolean(c.authProvider)).length;
  const retailCount = contacts.filter((c) => c.source === 'retail' || (c.ordersCount && c.ordersCount > 0)).length;
  const leadsCount = contacts.filter((c) => c.source === 'lead').length;

  return (
    <BroadcastPageClient
      initialCounts={{
        retailCustomersCount: retailCount,
        leadsCount: leadsCount,
        registeredCustomersCount: registeredCount,
        totalUniqueContacts: contacts.length,
      }}
      initialContacts={contacts}
    />
  );
}
