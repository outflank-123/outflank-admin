import { createAdminClient } from '@/lib/supabase/admin'
import CustomersTableClient, { StorefrontCustomer, CustomerOrderSummary } from './CustomersTableClient'

export const revalidate = 60

export default async function CustomersPage() {
  const supabase = createAdminClient()

  // 1. Fetch all registered customers
  let customersData: any[] = []
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      customersData = data
    }
  } catch (err) {
    console.warn('[Customers Page] Error fetching customers table:', err)
  }

  // 2. Fetch all retail orders to aggregate spend, order history, and identify guest shoppers
  let ordersData: any[] = []
  try {
    const { data, error } = await supabase
      .from('retail_orders')
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        total_amount,
        status,
        created_at,
        customer_uid,
        payment_method,
        awb_number,
        shipping_address
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      ordersData = data
    }
  } catch (err) {
    console.warn('[Customers Page] Error fetching retail orders:', err)
  }

  // 3. Map orders by UID, Phone, and Email for high-precision aggregation
  const ordersByUid = new Map<string, any[]>()
  const ordersByPhone = new Map<string, any[]>()
  const ordersByEmail = new Map<string, any[]>()

  ordersData.forEach((ord) => {
    if (ord.customer_uid) {
      if (!ordersByUid.has(ord.customer_uid)) ordersByUid.set(ord.customer_uid, [])
      ordersByUid.get(ord.customer_uid)!.push(ord)
    }
    const cleanPhone = (ord.customer_phone || '').replace(/\D/g, '').slice(-10)
    if (cleanPhone) {
      if (!ordersByPhone.has(cleanPhone)) ordersByPhone.set(cleanPhone, [])
      ordersByPhone.get(cleanPhone)!.push(ord)
    }
    const cleanEmail = (ord.customer_email || '').trim().toLowerCase()
    if (cleanEmail) {
      if (!ordersByEmail.has(cleanEmail)) ordersByEmail.set(cleanEmail, [])
      ordersByEmail.get(cleanEmail)!.push(ord)
    }
  })

  const handledOrderIds = new Set<string>()
  const consolidatedCustomers: StorefrontCustomer[] = []

  // 4. Process all registered accounts
  customersData.forEach((cust) => {
    const matchedOrdersMap = new Map<string, any>()

    // Check by Firebase UID
    if (cust.firebase_uid && ordersByUid.has(cust.firebase_uid)) {
      ordersByUid.get(cust.firebase_uid)!.forEach((o) => matchedOrdersMap.set(o.id, o))
    }

    // Check by Phone
    const cleanCustPhone = (cust.phone || cust.shipping_address?.phone || '').replace(/\D/g, '').slice(-10)
    if (cleanCustPhone && ordersByPhone.has(cleanCustPhone)) {
      ordersByPhone.get(cleanCustPhone)!.forEach((o) => matchedOrdersMap.set(o.id, o))
    }

    // Check by Email
    const cleanCustEmail = (cust.email || cust.shipping_address?.email || '').trim().toLowerCase()
    if (cleanCustEmail && ordersByEmail.has(cleanCustEmail)) {
      ordersByEmail.get(cleanCustEmail)!.forEach((o) => matchedOrdersMap.set(o.id, o))
    }

    const matchedOrders = Array.from(matchedOrdersMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    matchedOrders.forEach((o) => handledOrderIds.add(o.id))

    const totalSpent = matchedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
    const recentOrder = matchedOrders[0] || null

    const orderSummaries: CustomerOrderSummary[] = matchedOrders.map((o) => ({
      id: o.id,
      total_amount: Number(o.total_amount) || 0,
      status: o.status || 'paid',
      created_at: o.created_at,
      payment_method: o.payment_method,
      awb_number: o.awb_number,
    }))

    consolidatedCustomers.push({
      id: cust.id || cust.firebase_uid,
      firebaseUid: cust.firebase_uid || null,
      name: cust.full_name || cust.shipping_address?.fullName || (cust.email ? cust.email.split('@')[0] : 'Storefront Customer'),
      email: cust.email || cust.shipping_address?.email || null,
      phone: cleanCustPhone ? cleanCustPhone : null,
      avatarUrl: cust.avatar_url || null,
      authProvider: (cust.auth_provider as any) || (cust.phone ? 'whatsapp' : 'google'),
      ordersCount: matchedOrders.length,
      totalSpent,
      lastOrderDate: recentOrder?.created_at || null,
      recentStatus: recentOrder?.status || null,
      registeredAt: cust.created_at || new Date().toISOString(),
      companyName: cust.company_name || cust.shipping_address?.companyName || null,
      gstin: cust.gstin || cust.shipping_address?.gstin || null,
      gender: cust.gender || cust.shipping_address?.gender || null,
      shippingAddress: cust.shipping_address || null,
      orders: orderSummaries,
    })
  })

  // 5. Discover guest buyers from unhandled orders
  const guestBuyersMap = new Map<string, any[]>()
  ordersData.forEach((ord) => {
    if (handledOrderIds.has(ord.id)) return
    const key = (ord.customer_phone || '').replace(/\D/g, '').slice(-10) || (ord.customer_email || '').toLowerCase()
    if (!key) return
    if (!guestBuyersMap.has(key)) guestBuyersMap.set(key, [])
    guestBuyersMap.get(key)!.push(ord)
  })

  guestBuyersMap.forEach((guestOrders, key) => {
    const first = guestOrders[0]
    const cleanPhone = (first.customer_phone || '').replace(/\D/g, '').slice(-10)
    const totalSpent = guestOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)

    let parsedAddr: any = null
    if (first.shipping_address) {
      try {
        parsedAddr = typeof first.shipping_address === 'string' ? JSON.parse(first.shipping_address) : first.shipping_address
      } catch {}
    }

    const orderSummaries: CustomerOrderSummary[] = guestOrders.map((o) => ({
      id: o.id,
      total_amount: Number(o.total_amount) || 0,
      status: o.status || 'paid',
      created_at: o.created_at,
      payment_method: o.payment_method,
      awb_number: o.awb_number,
    }))

    consolidatedCustomers.push({
      id: `guest_${key}`,
      firebaseUid: null,
      name: first.customer_name || 'Guest Buyer',
      email: first.customer_email || null,
      phone: cleanPhone || null,
      avatarUrl: null,
      authProvider: 'guest',
      ordersCount: guestOrders.length,
      totalSpent,
      lastOrderDate: first.created_at || null,
      recentStatus: first.status || null,
      registeredAt: first.created_at || new Date().toISOString(),
      companyName: null,
      gstin: null,
      gender: null,
      shippingAddress: parsedAddr ? {
        fullName: first.customer_name,
        phone: cleanPhone,
        email: first.customer_email,
        address: parsedAddr.addressLine1 || parsedAddr.address || '',
        city: parsedAddr.city || '',
        state: parsedAddr.state || '',
        pincode: parsedAddr.pincode || '',
      } : null,
      orders: orderSummaries,
    })
  })

  // Sort overall by newest registration / recent activity
  consolidatedCustomers.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())

  return <CustomersTableClient initialCustomers={consolidatedCustomers} />
}
