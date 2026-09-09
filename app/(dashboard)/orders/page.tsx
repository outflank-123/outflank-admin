import { createClient } from '@/lib/supabase/server'
import OrdersTableClient from './OrdersTableClient'

export const revalidate = 0

export default async function RetailOrdersPage() {
  const supabase = await createClient()

  // Fetch orders, ordered by newest first
  const { data: orders, error } = await supabase
    .from('retail_orders')
    .select(`
      id,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      total_amount,
      payment_method,
      status,
      created_at,
      retail_order_items (
        id,
        product_name,
        quantity,
        price_at_time,
        selected_color
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching retail orders:', error)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Retail Orders</h1>
          <p className="mt-2 text-sm text-gray-500">
            View and manage all B2C retail purchases.
          </p>
        </div>
      </div>
      <OrdersTableClient initialOrders={orders || []} />
    </div>
  )
}
