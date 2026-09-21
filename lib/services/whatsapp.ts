import { createAdminClient } from '@/lib/supabase/admin';

export interface WhatsAppSettings {
  whatsapp_support_phone: string;
  whatsapp_admin_alerts_phone: string;
  whatsapp_notifications_enabled: boolean;
  whatsapp_provider: 'meta_cloud' | 'interakt' | 'wati' | 'disabled';
  whatsapp_phone_number_id?: string | null;
  whatsapp_business_account_id?: string | null;
  whatsapp_access_token?: string | null;
  whatsapp_templates?: {
    order_placed?: string;
    order_shipped?: string;
    order_delivered?: string;
    admin_order_alert?: string;
    admin_lead_alert?: string;
  };
}

const DEFAULT_SETTINGS: WhatsAppSettings = {
  whatsapp_support_phone: '919999926273',
  whatsapp_admin_alerts_phone: '919999926273',
  whatsapp_notifications_enabled: false,
  whatsapp_provider: 'meta_cloud',
  whatsapp_phone_number_id: null,
  whatsapp_business_account_id: null,
  whatsapp_access_token: null,
  whatsapp_templates: {
    order_placed: 'order_placed',
    order_shipped: 'order_shipped',
    order_delivered: 'order_delivered',
    admin_order_alert: 'admin_order_alert',
    admin_lead_alert: 'admin_lead_alert',
  },
};

/**
 * Clean and format Indian and international phone numbers for WhatsApp API.
 * e.g., "99999 26273" -> "919999926273"
 */
export function formatWhatsAppPhone(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  const cleaned = rawPhone.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  if (cleaned.length === 10) return `91${cleaned}`;
  return cleaned;
}

/**
 * Fetch WhatsApp configuration from store_settings or environment fallbacks.
 */
export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      return {
        ...DEFAULT_SETTINGS,
        whatsapp_support_phone: process.env.WHATSAPP_SUPPORT_PHONE || DEFAULT_SETTINGS.whatsapp_support_phone,
        whatsapp_admin_alerts_phone: process.env.WHATSAPP_ADMIN_ALERTS_PHONE || DEFAULT_SETTINGS.whatsapp_admin_alerts_phone,
        whatsapp_notifications_enabled: process.env.WHATSAPP_NOTIFICATIONS_ENABLED === 'true',
        whatsapp_provider: (process.env.WHATSAPP_PROVIDER as any) || DEFAULT_SETTINGS.whatsapp_provider,
        whatsapp_phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
        whatsapp_access_token: process.env.WHATSAPP_ACCESS_TOKEN || null,
      };
    }

    return {
      whatsapp_support_phone: data.whatsapp_support_phone || DEFAULT_SETTINGS.whatsapp_support_phone,
      whatsapp_admin_alerts_phone: data.whatsapp_admin_alerts_phone || DEFAULT_SETTINGS.whatsapp_admin_alerts_phone,
      whatsapp_notifications_enabled: Boolean(data.whatsapp_notifications_enabled),
      whatsapp_provider: data.whatsapp_provider || DEFAULT_SETTINGS.whatsapp_provider,
      whatsapp_phone_number_id: data.whatsapp_phone_number_id || null,
      whatsapp_business_account_id: data.whatsapp_business_account_id || null,
      whatsapp_access_token: data.whatsapp_access_token || null,
      whatsapp_templates: data.whatsapp_templates || DEFAULT_SETTINGS.whatsapp_templates,
    };
  } catch (err) {
    console.error('[WhatsApp Service] Error reading settings:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Core sender: Dispatches an outbound WhatsApp message via Meta Cloud API or BSP.
 */
export async function sendWhatsAppMessage({
  to,
  messageText,
  templateName,
  templateParams = [],
  mediaUrl,
  linkUrl,
  buttonText,
}: {
  to: string;
  messageText: string;
  templateName?: string;
  templateParams?: string[];
  mediaUrl?: string;
  linkUrl?: string;
  buttonText?: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const formattedPhone = formatWhatsAppPhone(to);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid recipient phone number' };
  }

  const settings = await getWhatsAppSettings();

  if (!settings.whatsapp_notifications_enabled && process.env.NODE_ENV === 'production') {
    return { success: false, error: 'WhatsApp automated notifications are disabled in settings' };
  }

  // Compose text with link if provided and not already in message
  let composedText = messageText;
  if (linkUrl && !messageText.includes(linkUrl)) {
    composedText = `${messageText}\n\n${buttonText || 'Visit Now'}: ${linkUrl}`;
  }

  // ── 1. Meta Cloud API (Official Graph API) ──
  if (settings.whatsapp_provider === 'meta_cloud') {
    const phoneNumberId = settings.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = settings.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      console.warn('[WhatsApp Service] Meta Cloud API credentials not configured (Phone ID or Token missing)');
      return { success: false, error: 'Meta Cloud API credentials missing' };
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

      let payload: any;

      if (templateName) {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [
              ...(mediaUrl
                ? [
                    {
                      type: 'header',
                      parameters: [{ type: 'image', image: { link: mediaUrl } }],
                    },
                  ]
                : []),
              {
                type: 'body',
                parameters: templateParams.map(param => ({
                  type: 'text',
                  text: param,
                })),
              },
            ],
          },
        };
      } else if (mediaUrl) {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'image',
          image: {
            link: mediaUrl,
            caption: composedText,
          },
        };
      } else {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: { preview_url: true, body: composedText },
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('[WhatsApp Service] Meta API Error:', json);
        return { success: false, error: json.error?.message || 'Meta Cloud API rejected message' };
      }

      const messageId = json.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (error: any) {
      console.error('[WhatsApp Service] Network exception dispatching message:', error);
      return { success: false, error: error.message || 'Network exception' };
    }
  }

  // ── 2. Interakt / Wati Provider API ──
  if (settings.whatsapp_provider === 'interakt' || settings.whatsapp_provider === 'wati') {
    const apiKey = settings.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!apiKey) {
      return { success: false, error: `${settings.whatsapp_provider} API key missing` };
    }

    try {
      // Interakt standard track/event endpoint
      const res = await fetch('https://api.interakt.ai/v1/public/message/', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          countryCode: '+91',
          phoneNumber: formattedPhone.startsWith('91') ? formattedPhone.slice(2) : formattedPhone,
          type: 'Template',
          template: {
            name: templateName || 'order_update',
            languageCode: 'en',
            bodyValues: templateParams.length ? templateParams : [messageText],
          },
        }),
      });

      const data = await res.json();
      return { success: res.ok, messageId: data.id, error: res.ok ? undefined : data.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: `Provider ${settings.whatsapp_provider} not active` };
}

// ─────────────────────────────────────────────────────────────
// HIGHER-LEVEL TRANSACTIONAL NOTIFICATION TRIGGERS
// ─────────────────────────────────────────────────────────────

/**
 * Triggered upon successful order creation (Paid Razorpay or COD).
 */
export async function sendOrderPlacedNotification({
  order,
  siteUrl = 'https://outflank.in',
}: {
  order: any;
  siteUrl?: string;
}) {
  try {
    const customerName = order.customer_name || 'Valued Customer';
    const orderRef = `#${order.id.slice(0, 8).toUpperCase()}`;
    const totalAmount = `₹${Number(order.total_amount).toLocaleString('en-IN')}`;
    const trackUrl = `${siteUrl}/track?order_id=${order.id}&email=${encodeURIComponent(order.customer_email || '')}`;
    const invoiceUrl = `${siteUrl}/invoice/${order.id}`;

    const textBody = 
      `*Order Confirmed* (Order ${orderRef})\n\n` +
      `Hi ${customerName},\n` +
      `Thank you for choosing Outflank! Your order for ${totalAmount} has been confirmed.\n\n` +
      `*Status:* In Production\n` +
      `*View Tax Invoice:* ${invoiceUrl}\n` +
      `*Track Live:* ${trackUrl}\n\n` +
      `We will notify you as soon as your package is dispatched!`;

    // 1. Send to Customer
    sendWhatsAppMessage({
      to: order.customer_phone,
      messageText: textBody,
      templateName: 'order_placed',
      templateParams: [customerName, orderRef, totalAmount, trackUrl],
    }).catch(err => console.error('[WhatsApp Placed] Customer send failed:', err));

    // 2. Mark order as notified in background
    const supabase = createAdminClient();
    await supabase
      .from('retail_orders')
      .update({ whatsapp_notified_placed: true })
      .eq('id', order.id);

  } catch (err) {
    console.error('[WhatsApp Placed Trigger Error]:', err);
  }
}

/**
 * Triggered upon carrier dispatch and AWB generation with Shadowfax.
 */
export async function sendOrderShippedNotification({
  order,
  awbNumber,
  courierName = 'Shadowfax Surface Express',
  siteUrl = 'https://outflank.in',
}: {
  order: any;
  awbNumber: string;
  courierName?: string;
  siteUrl?: string;
}) {
  try {
    const customerName = order.customer_name || 'Customer';
    const orderRef = `#${order.id.slice(0, 8).toUpperCase()}`;
    const trackUrl = `https://shadowfax.in/tracking/${awbNumber}`;

    const textBody = 
      `*Your Outflank Order Has Shipped*\n\n` +
      `Hi ${customerName},\n` +
      `Great news! Your order ${orderRef} has been dispatched via *${courierName}*.\n\n` +
      `*Tracking AWB:* ${awbNumber}\n` +
      `*Track Shipment:* ${trackUrl}\n\n` +
      `Expected delivery in 2-4 business days. Thank you for shopping with Outflank!`;

    // 1. Send to Customer
    sendWhatsAppMessage({
      to: order.customer_phone,
      messageText: textBody,
      templateName: 'order_shipped',
      templateParams: [customerName, orderRef, awbNumber, trackUrl],
    }).catch(err => console.error('[WhatsApp Shipped] Customer send failed:', err));

    // 2. Mark order as notified
    const supabase = createAdminClient();
    await supabase
      .from('retail_orders')
      .update({ whatsapp_notified_shipped: true })
      .eq('id', order.id);

  } catch (err) {
    console.error('[WhatsApp Shipped Trigger Error]:', err);
  }
}

/**
 * Triggered upon carrier delivery confirmation.
 */
export async function sendOrderDeliveredNotification({
  order,
  siteUrl = 'https://outflank.in',
}: {
  order: any;
  siteUrl?: string;
}) {
  try {
    const customerName = order.customer_name || 'Customer';
    const orderRef = `#${order.id.slice(0, 8).toUpperCase()}`;

    const textBody = 
      `*Order Delivered*\n\n` +
      `Hi ${customerName},\n` +
      `Your Outflank order ${orderRef} has been successfully delivered!\n\n` +
      `We hope you love your apparel. If you have any feedback or corporate requirements, simply reply to this message.\n\n` +
      `Visit us: ${siteUrl}`;

    sendWhatsAppMessage({
      to: order.customer_phone,
      messageText: textBody,
      templateName: 'order_delivered',
      templateParams: [customerName, orderRef, siteUrl],
    }).catch(err => console.error('[WhatsApp Delivered] Customer send failed:', err));

    const supabase = createAdminClient();
    await supabase
      .from('retail_orders')
      .update({ whatsapp_notified_delivered: true })
      .eq('id', order.id);

  } catch (err) {
    console.error('[WhatsApp Delivered Trigger Error]:', err);
  }
}

/**
 * Triggered when a new order is received to alert store administrators.
 */
export async function sendAdminNewOrderAlert({
  order,
  adminUrl = 'https://admin.outflank.in/orders',
}: {
  order: any;
  adminUrl?: string;
}) {
  try {
    const settings = await getWhatsAppSettings();
    if (!settings.whatsapp_admin_alerts_phone) return;

    const orderRef = `#${order.id.slice(0, 8).toUpperCase()}`;
    const amount = `₹${Number(order.total_amount).toLocaleString('en-IN')}`;
    const payment = order.payment_method === 'cod' ? 'Cash on Delivery (COD)' : 'Prepaid (Razorpay)';

    let parsedAddress: any = order.shipping_address;
    if (typeof parsedAddress === 'string') {
      try { parsedAddress = JSON.parse(parsedAddress); } catch {}
    }

    const textBody = 
      `*New Outflank Order Placed*\n\n` +
      `• *Order:* ${orderRef}\n` +
      `• *Customer:* ${order.customer_name} (${order.customer_phone})\n` +
      `• *Amount:* ${amount}\n` +
      `• *Payment:* ${payment}\n` +
      `• *City:* ${parsedAddress?.city || 'India'}\n\n` +
      `*Open Dashboard:* ${adminUrl}`;

    sendWhatsAppMessage({
      to: settings.whatsapp_admin_alerts_phone,
      messageText: textBody,
      templateName: 'admin_order_alert',
      templateParams: [orderRef, order.customer_name, amount, payment],
    }).catch(err => console.error('[WhatsApp Admin Alert Error]:', err));

  } catch (err) {
    console.error('[WhatsApp Admin Alert Error]:', err);
  }
}

export const sendAdminOrderAlertNotification = sendAdminNewOrderAlert;

/**
 * Alert store owner on incoming corporate B2B inquiry/lead.
 */
export async function sendAdminLeadAlertNotification({
  lead,
  adminUrl = 'https://admin.outflank.in/leads',
}: {
  lead: any;
  adminUrl?: string;
}) {
  try {
    const settings = await getWhatsAppSettings();
    if (!settings.whatsapp_admin_alerts_phone) return;

    const textBody = 
      `*New B2B Corporate Lead Submitted*\n\n` +
      `• *Contact:* ${lead.name || 'Anonymous'}\n` +
      `• *Company:* ${lead.company_name || 'N/A'}\n` +
      `• *Phone:* ${lead.phone || 'N/A'}\n` +
      `• *Email:* ${lead.email || 'N/A'}\n` +
      `• *Product:* ${lead.product_name || 'Corporate Gifting'}\n` +
      `• *Quantity:* ${lead.quantity || '50+'}\n\n` +
      `*View Leads:* ${adminUrl}`;

    sendWhatsAppMessage({
      to: settings.whatsapp_admin_alerts_phone,
      messageText: textBody,
      templateName: 'admin_lead_alert',
      templateParams: [lead.name || 'Lead', lead.company_name || 'Company', lead.phone || 'N/A'],
    }).catch(err => console.error('[WhatsApp Lead Alert Error]:', err));

  } catch (err) {
    console.error('[WhatsApp Lead Alert Error]:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// MANUAL 1-CLICK PRE-FILLED WHATSAPP LINK GENERATORS
// ─────────────────────────────────────────────────────────────

export function getWhatsAppDirectUrl({
  phone,
  message,
}: {
  phone: string;
  message: string;
}): string {
  const formatted = formatWhatsAppPhone(phone);
  return `https://wa.me/${formatted || '919999926273'}?text=${encodeURIComponent(message)}`;
}

export function getCustomerOrderWhatsAppUrl(order: any, type: 'chat' | 'tracking' | 'invoice' | 'artwork'): string {
  const phone = order.customer_phone || '';
  const orderRef = `#${order.id.slice(0, 8).toUpperCase()}`;

  switch (type) {
    case 'tracking':
      return getWhatsAppDirectUrl({
        phone,
        message: `Hi ${order.customer_name || 'there'}, your Outflank order ${orderRef} has been dispatched with Shadowfax! AWB Tracking: ${order.awb_number || 'Pending'}. Track live: https://shadowfax.in/tracking/${order.awb_number || ''}`,
      });
    case 'invoice':
      return getWhatsAppDirectUrl({
        phone,
        message: `Hi ${order.customer_name || 'there'}, here is your official Outflank Tax Invoice for Order ${orderRef}: https://outflank.in/invoice/${order.id}`,
      });
    case 'artwork':
      return getWhatsAppDirectUrl({
        phone,
        message: `Hi ${order.customer_name || 'there'}, regarding your custom apparel order ${orderRef}: Could you please share your logo in high-resolution vector/PNG format for printing? Thank you!`,
      });
    case 'chat':
    default:
      return getWhatsAppDirectUrl({
        phone,
        message: `Hi ${order.customer_name || 'there'}, this is Outflank customer support regarding your Order ${orderRef}...`,
      });
  }
}
