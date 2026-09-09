"use client"

import React, { useState, useMemo } from 'react'
import { Eye, Clock, CheckCircle2, XCircle, Package, Truck, Loader2, ChevronDown, ChevronRight, Search, MapPin, Phone, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface OrderItem {
  id: string
  product_name: string
  quantity: number
  price_at_time: number
  selected_color: string | null
  products?: any
}

interface Order {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: any // JSON could be string or object
  total_amount: number
  payment_method: string
  status: string
  created_at: string
  retail_order_items: OrderItem[]
}

export default function OrdersTableClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [dateFilter, setDateFilter] = useState('all_time')

  const router = useRouter()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
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
      setOrders(previousOrders)
      alert('Failed to update order status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleExpand = (orderId: string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null)
    } else {
      setExpandedOrderId(orderId)
    }
  }

  const statusOptions = [
    { value: 'pending', label: 'Pending', icon: Clock, colorClass: 'bg-amber-100 text-amber-800' },
    { value: 'paid', label: 'Paid', icon: CheckCircle2, colorClass: 'bg-emerald-100 text-emerald-800' },
    { value: 'shipped', label: 'Shipped', icon: Truck, colorClass: 'bg-blue-100 text-blue-800' },
    { value: 'delivered', label: 'Delivered', icon: CheckCircle2, colorClass: 'bg-green-100 text-green-800' },
    { value: 'failed', label: 'Failed', icon: XCircle, colorClass: 'bg-red-100 text-red-800' },
    { value: 'cancelled', label: 'Cancelled', icon: XCircle, colorClass: 'bg-gray-100 text-gray-800' },
  ]

  const getStatusStyles = (statusValue: string) => {
    const opt = statusOptions.find(o => o.value === statusValue)
    return opt ? opt.colorClass : 'bg-gray-100 text-gray-800'
  }

  // Filter Logic
  const filteredOrders = useMemo(() => {
    let result = [...orders]

    // 1. Status Tab Filter
    if (activeTab !== 'all') {
      result = result.filter(o => o.status === activeTab)
    }

    // 2. Date Filter
    const now = new Date()
    if (dateFilter === 'today') {
      result = result.filter(o => new Date(o.created_at).toDateString() === now.toDateString())
    } else if (dateFilter === 'yesterday') {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      result = result.filter(o => new Date(o.created_at).toDateString() === yesterday.toDateString())
    } else if (dateFilter === 'last_7_days') {
      const last7Days = new Date(now)
      last7Days.setDate(last7Days.getDate() - 7)
      result = result.filter(o => new Date(o.created_at) >= last7Days)
    } else if (dateFilter === 'last_30_days') {
      const last30Days = new Date(now)
      last30Days.setDate(last30Days.getDate() - 30)
      result = result.filter(o => new Date(o.created_at) >= last30Days)
    }

    // 3. Search Filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase()
      result = result.filter(o => 
        o.id.toLowerCase().includes(lowerQuery) ||
        o.customer_name.toLowerCase().includes(lowerQuery) ||
        o.customer_email.toLowerCase().includes(lowerQuery) ||
        o.customer_phone?.toLowerCase().includes(lowerQuery)
      )
    }

    return result
  }, [orders, activeTab, dateFilter, searchQuery])

  const tabs = [
    { value: 'all', label: 'All Orders' },
    ...statusOptions
  ]

  return (
    <div className="space-y-6">
      
      {/* Filter Header */}
      <div className="bg-white p-4 shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl space-y-4">
        
        {/* Top Row: Search & Date */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by ID, name, email or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6"
            />
          </div>
          <div className="flex-shrink-0">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-black sm:text-sm sm:leading-6"
            >
              <option value="all_time">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Bottom Row: Status Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {tabs.map((tab) => {
            const count = tab.value === 'all' 
              ? orders.length 
              : orders.filter(o => o.status === tab.value).length

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.value 
                    ? 'bg-black text-white' 
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.value ? 'bg-gray-800 text-gray-200' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-visible">
        <div className="overflow-x-auto overflow-y-visible min-h-[400px]">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-10"></th>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Order Details</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Customer</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Payment</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {(!filteredOrders || filteredOrders.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-500">
                    <Package className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    No orders match your filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <React.Fragment key={order.id}>
                    <tr 
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedOrderId === order.id ? 'bg-gray-50' : ''}`}
                      onClick={() => toggleExpand(order.id)}
                    >
                      <td className="py-4 pl-4 pr-3 sm:pl-6">
                        <div className="text-gray-400 hover:text-gray-600 transition-transform duration-200" style={{ transform: expandedOrderId === order.id ? 'rotate(90deg)' : 'none' }}>
                          <ChevronRight size={18} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-4 pl-0 pr-3">
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
                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'
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
                      <td className="whitespace-nowrap px-3 py-4 text-sm relative" onClick={e => e.stopPropagation()}>
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
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-900 text-right pr-6">
                        {formatCurrency(order.total_amount)}
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row */}
                    {expandedOrderId === order.id && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50/80 px-4 py-6 border-b border-gray-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                            
                            {/* Shipping Details */}
                            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                <MapPin size={16} className="text-gray-500" />
                                Shipping Details
                              </h3>
                              <div className="space-y-3 text-sm text-gray-600">
                                <p className="font-medium text-gray-900">{order.customer_name}</p>
                                <p className="flex items-center gap-2">
                                  <Phone size={14} className="text-gray-400" />
                                  {order.customer_phone || 'No phone provided'}
                                </p>
                                <div className="pt-2 border-t border-gray-100">
                                  {order.shipping_address ? (
                                    (() => {
                                      let addr = order.shipping_address
                                      if (typeof addr === 'string') {
                                        try { addr = JSON.parse(addr) } catch (e) {}
                                      }
                                      return (
                                        <>
                                          <p>{addr.addressLine1}</p>
                                          <p>{addr.city}, {addr.state}</p>
                                          <p>PIN: {addr.pincode}</p>
                                        </>
                                      )
                                    })()
                                  ) : (
                                    <p className="text-red-500 italic">No shipping address provided</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Order Items */}
                            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                <ShoppingBag size={16} className="text-gray-500" />
                                Order Items
                              </h3>
                              <div className="space-y-4">
                                {order.retail_order_items && order.retail_order_items.length > 0 ? (
                                  order.retail_order_items.map((item) => (
                                    <div key={item.id} className="flex gap-4 items-start pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                                      {item.products && (Array.isArray(item.products) ? item.products[0]?.primary_image_url : item.products?.primary_image_url) ? (
                                        <div className="w-12 h-12 flex-shrink-0 bg-gray-50 rounded-md overflow-hidden border border-gray-100">
                                          <img src={Array.isArray(item.products) ? item.products[0]?.primary_image_url : item.products.primary_image_url} alt={item.product_name} className="w-full h-full object-cover" />
                                        </div>
                                      ) : (
                                        <div className="w-12 h-12 flex-shrink-0 bg-gray-50 rounded-md border border-gray-100 flex items-center justify-center">
                                          <Package className="h-5 w-5 text-gray-300" />
                                        </div>
                                      )}
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Qty: {item.quantity} {item.selected_color && `• Color: ${item.selected_color}`}
                                        </p>
                                      </div>
                                      <p className="text-sm font-medium text-gray-900 mt-1">
                                        {formatCurrency(Number(item.price_at_time) * item.quantity)}
                                      </p>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-gray-500 italic">No items found for this order.</p>
                                )}
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
