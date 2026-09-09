"use client"

import { useState } from 'react'
import { Eye, Clock, CheckCircle2, XCircle, Package, Truck, ChefHat, Loader2, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Order {
  id: string
  customer_name: string
  customer_email: string
  total_amount: number
  payment_method: string
  status: string
  created_at: string
}

export default function OrdersTableClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const router = useRouter()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Optimistic update
    const previousOrders = [...orders]
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    setUpdatingId(orderId)

    try {
      const res = await fetch('/api/admin/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus })
      })

      if (!res.ok) {
        throw new Error('Failed to update')
      }
      router.refresh()
    } catch (error) {
      console.error(error)
      // Revert on failure
      setOrders(previousOrders)
      alert('Failed to update order status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const statusOptions = [
    { value: 'pending', label: 'Pending', icon: Clock, colorClass: 'bg-amber-100 text-amber-800' },
    { value: 'paid', label: 'Paid', icon: CheckCircle2, colorClass: 'bg-emerald-100 text-emerald-800' },
    { value: 'preparing', label: 'Preparing', icon: ChefHat, colorClass: 'bg-purple-100 text-purple-800' },
    { value: 'in_transit', label: 'In Transit', icon: Truck, colorClass: 'bg-blue-100 text-blue-800' },
    { value: 'delivered', label: 'Delivered', icon: CheckCircle2, colorClass: 'bg-green-100 text-green-800' },
    { value: 'cancelled', label: 'Cancelled', icon: XCircle, colorClass: 'bg-red-100 text-red-800' },
  ]

  const getStatusStyles = (statusValue: string) => {
    const opt = statusOptions.find(o => o.value === statusValue)
    return opt ? opt.colorClass : 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-visible">
      <div className="overflow-x-auto overflow-y-visible min-h-[400px]">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Order Details</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Customer</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Payment</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {(!orders || orders.length === 0) ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-gray-500">
                  <Package className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  No retail orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Package className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-xs uppercase">
                          #{order.id.split('-')[0]}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <div className="font-medium text-gray-900">{order.customer_name}</div>
                    <div className="text-gray-500 text-xs">{order.customer_email}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${order.payment_method === 'cod' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                      {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Razorpay'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm relative">
                    <div className="relative inline-block w-36">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        disabled={updatingId === order.id}
                        className={`appearance-none w-full outline-none cursor-pointer pl-3 pr-8 py-1.5 rounded-full text-xs font-semibold capitalize border border-transparent hover:border-gray-200 transition-all ${getStatusStyles(order.status)} ${updatingId === order.id ? 'opacity-50' : ''}`}
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.value} value={opt.value} className="bg-white text-gray-900">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                        {updatingId === order.id ? (
                          <Loader2 size={12} className="animate-spin text-gray-600" />
                        ) : (
                          <ChevronDown size={14} className="opacity-70" />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-900">
                    {formatCurrency(order.total_amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
