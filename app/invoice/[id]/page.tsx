import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import PrintInvoiceButton from './PrintInvoiceButton';
import { Paintbrush, ArrowLeft, ExternalLink, Package, ShieldCheck, CheckCircle2, Truck } from 'lucide-react';

interface CustomDetail {
  isCustomized: boolean;
  brandType: 'text' | 'logo';
  brandText?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  logoUrl?: string | null;
  printPosition?: string | null;
  coordinates?: { top?: string | number; left?: string | number; width?: string | number } | null;
  customizationLabel?: string | null;
}

function extractCustomData(item: any, order: any): CustomDetail | null {
  let c = item.customization;
  if (!c && order.notes) {
    try {
      const parsed = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
      const found = parsed?.custom_items?.find((ci: any) => ci.product_name === item.product_name);
      if (found?.customization) c = found.customization;
    } catch {}
  }
  if (!c && item.selected_color && item.selected_color.includes('Custom')) {
    const match = item.selected_color.match(/Custom:?\s*"?([^"\]]+)"?/i);
    if (match) {
      return {
        isCustomized: true,
        brandType: 'text',
        brandText: match[1],
        printPosition: 'Left Chest',
        textColor: '#FFFFFF',
      };
    }
  }
  if (!c || (!c.isCustomized && !c.is_customized && !c.brandText && !c.brand_text && !c.logoUrl && !c.logo_url)) {
    return null;
  }

  const brandText = c.brandText || c.brand_text || c.text || null;
  const logoUrl = c.logoUrl || c.logo_url || null;
  const brandType: 'text' | 'logo' = c.brandType || (logoUrl ? 'logo' : 'text');
  const textColor = c.textColor || c.text_color || '#FFFFFF';
  const fontFamily = c.fontFamily || c.font_family || 'Standard Sans';

  let printPos = c.printPosition || c.print_position || 'Left Chest';
  if (printPos === 'center_chest') printPos = 'Center Chest';
  if (printPos === 'left_chest') printPos = 'Left Chest';
  if (printPos === 'right_chest') printPos = 'Right Chest';

  const coords = c.coordinates || c.position || null;

  return {
    isCustomized: true,
    brandType,
    brandText,
    textColor,
    fontFamily,
    logoUrl,
    printPosition: printPos,
    coordinates: coords,
    customizationLabel: c.customizationLabel || c.customization_label || null,
  };
}

function parseAddress(raw: any) {
  if (!raw) return { addressLine1: '', city: '', state: '', pincode: '' };
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/-?\s*(\d{6})$/);
    const pincode = match ? match[1] : '';
    return { addressLine1: raw, city: '', state: '', pincode };
  }
}

export default async function InvoicePage({ params }: any) {
  const { id } = await params;
  const supabase = createAdminClient();

  let { data: order, error } = await supabase
    .from('retail_orders')
    .select(`
      *,
      retail_order_items (
        *,
        products (
          id,
          name,
          primary_image_url
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !order) {
    const fallback = await supabase
      .from('retail_orders')
      .select(`*, retail_order_items (*)`)
      .eq('id', id)
      .single();
    order = fallback.data;
    error = fallback.error;
  }

  if (error || !order) {
    return notFound();
  }

  const shippingAddress = parseAddress(order.shipping_address);
  const subtotal = Number(order.total_amount) - Number(order.shipping_fee || 0);
  const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const hasAnyCustom = order.retail_order_items?.some((item: any) => Boolean(extractCustomData(item, order)));

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center p-4 sm:p-8 font-sans print:p-0 print:bg-white print:m-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            margin: 10mm;
            size: A4 portrait;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}} />
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-black/5 flex flex-col relative print:shadow-none print:border-none print:rounded-none print:m-0 print:p-0 print:max-w-none">
        
        {/* Top Control Bar - Hidden on print */}
        <div className="bg-[#fafafc] px-6 py-4 flex flex-wrap justify-between items-center print:hidden border-b border-black/5 rounded-t-3xl gap-3">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-black transition-colors"
            >
              <ArrowLeft size={14} /> Back to Store
            </Link>
            <span className="text-gray-300">|</span>
            <Link 
              href="/track"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-black transition-colors"
            >
              Track Order Status
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:inline">Official Tax & Order Invoice</span>
            <PrintInvoiceButton />
          </div>
        </div>

        {/* Invoice Body Content */}
        <div id="invoice-content" className="p-6 sm:p-10 bg-white text-sm print:p-6 print:text-xs">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b border-gray-200 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <img 
                  src="/logo/outflank-logo.png" 
                  alt="Outflank" 
                  className="h-9 w-auto object-contain" 
                />
                <span className="text-xl font-extrabold tracking-tight text-[#1d1d1f]">OUTFLANK</span>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed">
                Premium Apparel & Corporate Customization<br />
                <span className="text-gray-700 font-medium">Support:</span> info@outflank.in · <span className="text-gray-700 font-medium">Web:</span> outflank.in
              </p>
            </div>

            <div className="text-left sm:text-right">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 mb-1">TAX INVOICE</h1>
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  <span className="font-semibold text-gray-800">Invoice No:</span>{' '}
                  <span className="font-mono font-bold text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</span>
                </p>
                <p>
                  <span className="font-semibold text-gray-800">Order ID:</span>{' '}
                  <span className="font-mono text-[11px] text-gray-600 break-all">{order.id}</span>
                </p>
                <p>
                  <span className="font-semibold text-gray-800">Date:</span> {formattedDate}
                </p>
                <div className="pt-1 flex items-center justify-start sm:justify-end gap-2">
                  <span className="font-semibold text-gray-800">Payment:</span>
                  {order.status === 'paid' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={11} /> PAID (Razorpay)
                    </span>
                  ) : order.payment_method === 'cod' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      CASH ON DELIVERY
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                      {order.status.toUpperCase()}
                    </span>
                  )}
                </div>
                {order.razorpay_payment_id && (
                  <p className="text-[11px] font-mono text-gray-500">
                    Txn ID: {order.razorpay_payment_id}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Billing & Order Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-gray-200 text-xs">
            <div>
              <h2 className="font-bold text-gray-400 uppercase tracking-widest text-[10px] mb-2">Billed & Shipped To</h2>
              <p className="font-bold text-gray-900 text-sm mb-1">{order.customer_name}</p>
              <p className="text-gray-600 leading-relaxed">
                {shippingAddress.addressLine1 || shippingAddress.address || '—'}<br />
                {shippingAddress.city ? `${shippingAddress.city}, ` : ''}{shippingAddress.state || ''} {shippingAddress.pincode ? `- ${shippingAddress.pincode}` : ''}
              </p>
              <div className="mt-2 text-gray-600 space-y-0.5">
                <p><span className="font-medium text-gray-700">Phone:</span> {order.customer_phone}</p>
                <p><span className="font-medium text-gray-700">Email:</span> {order.customer_email}</p>
              </div>
            </div>

            <div className="sm:text-right flex flex-col justify-between">
              <div>
                <h2 className="font-bold text-gray-400 uppercase tracking-widest text-[10px] mb-2">Dispatch & Order Details</h2>
                <div className="space-y-1 text-gray-600">
                  <p>
                    <span className="font-semibold text-gray-800">Order Channel:</span> Outflank Online Store
                  </p>
                  {order.awb_number && (
                    <p className="flex items-center sm:justify-end gap-1 font-mono text-blue-700 font-bold">
                      <Truck size={12} /> AWB: {order.awb_number}
                    </p>
                  )}
                  {hasAnyCustom && (
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Paintbrush size={11} /> Contains Custom Personalized Items
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="my-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-900 text-[11px] font-bold uppercase tracking-wider text-gray-900">
                  <th className="py-2.5 w-8 text-center text-gray-500 font-semibold">#</th>
                  <th className="py-2.5">Item & Personalization Specifications</th>
                  <th className="py-2.5 text-center w-16">Qty</th>
                  <th className="py-2.5 text-right w-24">Unit Price</th>
                  <th className="py-2.5 text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {order.retail_order_items?.map((item: any, idx: number) => {
                  const custom = extractCustomData(item, order);
                  const prodImg = (Array.isArray(item.products) ? item.products[0] : item.products)?.primary_image_url;

                  return (
                    <tr key={item.id || idx} className="align-top">
                      <td className="py-3 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-3 items-start">
                          {prodImg && (
                            <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden shrink-0 relative">
                              <img src={prodImg} alt={item.product_name} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm">{item.product_name}</p>
                            {item.selected_color && (
                              <p className="text-gray-500 text-xs mt-0.5">
                                Color: <span className="font-medium text-gray-800">{item.selected_color}</span>
                              </p>
                            )}

                            {/* ── Customization Box ── */}
                            {custom && (
                              <div className="mt-2.5 p-3 rounded-xl border border-blue-200/90 bg-blue-50/40 print:bg-gray-50 print:border-gray-300">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 print:text-gray-900 mb-2">
                                  <Paintbrush size={13} className="text-blue-600 print:text-gray-700 shrink-0" />
                                  <span className="uppercase tracking-wider">Custom Print Specification</span>
                                </div>

                                {/* Custom Text */}
                                {custom.brandType === 'text' && custom.brandText && (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                                      <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-gray-200 shadow-2xs print:border-gray-300">
                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Text:</span>
                                        <span className="font-mono font-bold text-gray-900 text-sm">"{custom.brandText}"</span>
                                      </div>

                                      {custom.textColor && (
                                        <div className="inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-2xs print:border-gray-300">
                                          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Ink:</span>
                                          <span 
                                            className="w-3.5 h-3.5 rounded-full border border-gray-300 shadow-2xs inline-block shrink-0" 
                                            style={{ backgroundColor: custom.textColor }}
                                            title={custom.textColor}
                                          />
                                          <span className="font-mono text-[11px] text-gray-800 font-semibold">{custom.textColor}</span>
                                        </div>
                                      )}

                                      <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-gray-200 shadow-2xs print:border-gray-300">
                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Placement:</span>
                                        <span className="font-semibold text-gray-800">{custom.printPosition}</span>
                                      </div>
                                    </div>

                                    {custom.coordinates && (
                                      <p className="text-[10px] text-gray-500 font-mono">
                                        Coordinates: Top {custom.coordinates.top} · Left {custom.coordinates.left}
                                        {custom.coordinates.width ? ` · Scale ${custom.coordinates.width}` : ''}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Custom Logo */}
                                {custom.brandType === 'logo' && (
                                  <div className="flex flex-wrap items-start gap-3">
                                    {custom.logoUrl && (
                                      <div className="flex flex-col items-center gap-1">
                                        <div className="w-14 h-14 rounded-lg bg-white border border-gray-300 p-1 flex items-center justify-center relative shadow-2xs overflow-hidden print:border-gray-400">
                                          <img 
                                            src={custom.logoUrl} 
                                            alt="Custom Logo Attached" 
                                            className="max-w-full max-h-full object-contain"
                                          />
                                        </div>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Attached Logo</span>
                                      </div>
                                    )}
                                    <div className="flex flex-col justify-center gap-1 text-xs pt-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900">Custom Uploaded Logo Graphic</span>
                                        <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                          Vector/WebP Verified
                                        </span>
                                      </div>
                                      <p className="text-gray-600 text-[11px]">
                                        Placement: <strong className="text-gray-900">{custom.printPosition}</strong>
                                        {custom.coordinates && (
                                          <span className="text-[10px] font-mono text-gray-400 ml-1.5">
                                            ({custom.coordinates.left}, {custom.coordinates.top})
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center text-gray-700 font-semibold">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-700 font-mono">₹{Number(item.price_at_time).toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right text-gray-900 font-bold font-mono">₹{(Number(item.price_at_time) * item.quantity).toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & Quality Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t-2 border-gray-900">
            {/* Guarantee Note */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 print:border-gray-300 flex items-start gap-3 text-xs">
              <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-gray-900">Quality Inspection & Custom Craftsmanship</p>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Every custom personalized piece is individually inspected at our facility prior to dispatch. Print files and placement parameters are permanently archived with this order.
                </p>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-gray-900 font-mono">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600">
                <span>Shipping & Handling</span>
                <span className="font-semibold text-gray-900 font-mono">
                  {order.shipping_fee > 0 ? `₹${Number(order.shipping_fee).toLocaleString('en-IN')}` : 'FREE'}
                </span>
              </div>
              <div className="flex justify-between py-2 text-sm">
                <span className="font-black text-gray-900 uppercase">Total Amount</span>
                <span className="font-black text-gray-900 font-mono text-base">₹{Number(order.total_amount).toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[10px] text-gray-400 text-right">
                All prices inclusive of applicable GST
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-500 space-y-1">
            <p className="font-bold text-gray-800">Thank you for choosing Outflank!</p>
            <p className="text-gray-500">
              For queries or corporate bulk inquiries, contact <strong className="text-gray-700">info@outflank.in</strong>
            </p>
            <p className="text-[10px] text-gray-400 pt-1">
              Track your shipment anytime at <strong className="text-gray-600">outflank.in/track</strong> with Order ID #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
