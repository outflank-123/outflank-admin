"use client"

import React, { useState, useMemo } from 'react'
import {
  Clock, CheckCircle2, XCircle, Package, Truck, Loader2,
  ChevronDown, ChevronRight, Search, MapPin, Phone, ShoppingBag,
  Send, X, Printer, ExternalLink, RefreshCw, AlertTriangle,
  Navigation, PackageCheck, Ban
} from 'lucide-react'
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
  shipping_address: any
  total_amount: number
  payment_method: string
  status: string
  created_at: string
  awb_number?: string | null
  dispatched_at?: string | null
  shadowfax_status?: string | null
  retail_order_items: OrderItem[]
}

// Parse address from JSON string or object
function parseAddress(raw: any) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return { addressLine1: raw } }
}

// Shadowfax status to human-readable
function sfxStatusLabel(status: string | null | undefined) {
  if (!status) return null
  const map: Record<string, { label: string; color: string }> = {
    new: { label: 'Order Placed', color: 'bg-blue-100 text-blue-700' },
    received_from_client_warehouse: { label: 'Picked Up', color: 'bg-indigo-100 text-indigo-700' },
    assigned_for_delivery: { label: 'Assigned for Delivery', color: 'bg-violet-100 text-violet-700' },
    ofd: { label: 'Out for Delivery', color: 'bg-amber-100 text-amber-700' },
    delivered: { label: 'Delivered ✓', color: 'bg-green-100 text-green-700' },
    cancelled_by_customer: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
    rto: { label: 'Return Initiated', color: 'bg-orange-100 text-orange-700' },
    rto_d: { label: 'Returned', color: 'bg-orange-100 text-orange-700' },
    lost: { label: 'Lost in Transit', color: 'bg-red-100 text-red-700' },
  }
  return map[status] || { label: status.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-700' }
}

export default function OrdersTableClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [dateFilter, setDateFilter] = useState('all_time')

  // Dispatch modal
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null)
  const [dispatchWeightKg, setDispatchWeightKg] = useState('0.5')
  const [dispatching, setDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null)

  const router = useRouter()

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

  // Only allow manual status change for non-dispatched orders
  const handleStatusChange = async (order: Order, newStatus: string) => {
    if (order.awb_number) return // Auto-managed by Shadowfax webhook
    const previousOrders = [...orders]
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
    setUpdatingId(order.id)
    try {
      const res = await fetch('/api/admin/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status: newStatus })
      })
      if (!res.ok) throw new Error('Failed to update')
      router.refresh()
    } catch {
      setOrders(previousOrders)
      alert('Failed to update order status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleExpand = (orderId: string) =>
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId)

  const handleDispatch = async () => {
    if (!dispatchOrder) return
    setDispatching(true)
    setDispatchError(null)
    setDispatchSuccess(null)
    try {
      const res = await fetch('/api/admin/shadowfax/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: dispatchOrder.id, weightKg: parseFloat(dispatchWeightKg) }),
      })
      const data = await res.json()
      if (!res.ok) { setDispatchError(data.error || 'Dispatch failed.'); return }
      setDispatchSuccess(data.awb_number)
      setOrders(prev => prev.map(o =>
        o.id === dispatchOrder.id
          ? { ...o, status: 'shipped', awb_number: data.awb_number, shadowfax_status: 'new', dispatched_at: new Date().toISOString() }
          : o
      ))
    } catch { setDispatchError('Network error. Please try again.') }
    finally { setDispatching(false) }
  }

  const openShippingLabel = (orderId: string) => {
    window.open(`/api/admin/shipping-label?orderId=${orderId}`, '_blank')
  }

  const statusOptions = [
    { value: 'pending', label: 'Pending', icon: Clock, colorClass: 'bg-amber-100 text-amber-800' },
    { value: 'paid', label: 'Paid', icon: CheckCircle2, colorClass: 'bg-emerald-100 text-emerald-800' },
    { value: 'shipped', label: 'Shipped', icon: Truck, colorClass: 'bg-blue-100 text-blue-800' },
    { value: 'out_for_delivery', label: 'Out for Delivery', icon: Navigation, colorClass: 'bg-violet-100 text-violet-800' },
    { value: 'delivered', label: 'Delivered', icon: PackageCheck, colorClass: 'bg-green-100 text-green-800' },
    { value: 'failed', label: 'Failed', icon: XCircle, colorClass: 'bg-red-100 text-red-800' },
    { value: 'cancelled', label: 'Cancelled', icon: Ban, colorClass: 'bg-gray-100 text-gray-800' },
  ]

  const getStatusStyles = (statusValue: string) =>
    statusOptions.find(o => o.value === statusValue)?.colorClass || 'bg-gray-100 text-gray-800'

  const baseFilteredOrders = useMemo(() => {
    let result = [...orders]
    const now = new Date()
    if (dateFilter === 'today') result = result.filter(o => new Date(o.created_at).toDateString() === now.toDateString())
    else if (dateFilter === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      result = result.filter(o => new Date(o.created_at).toDateString() === y.toDateString())
    } else if (dateFilter === 'last_7_days') {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      result = result.filter(o => new Date(o.created_at) >= d)
    } else if (dateFilter === 'last_30_days') {
      const d = new Date(now); d.setDate(d.getDate() - 30)
      result = result.filter(o => new Date(o.created_at) >= d)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.awb_number?.toLowerCase().includes(q)
      )
    }
    return result
  }, [orders, dateFilter, searchQuery])

  const filteredOrders = useMemo(() =>
    activeTab === 'all' ? baseFilteredOrders : baseFilteredOrders.filter(o => o.status === activeTab),
    [baseFilteredOrders, activeTab])

  const tabs = [{ value: 'all', label: 'All Orders' }, ...statusOptions]

  return (
    <div className="space-y-6">

      {/* Filter Header */}
      <div className="bg-white p-4 shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by ID, name, email, phone or AWB..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6"
            />
          </div>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="block rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-black sm:text-sm sm:leading-6"
          >
            <option value="all_time">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {tabs.map(tab => {
            const count = tab.value === 'all' ? baseFilteredOrders.length : baseFilteredOrders.filter(o => o.status === tab.value).length
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.value ? 'bg-black text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${activeTab === tab.value ? 'bg-gray-800 text-gray-200' : 'bg-gray-200 text-gray-600'}`}>{count}</span>
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
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-10"></th>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Order Details</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Customer</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Payment</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Shadowfax</th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 pr-6">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                    <Package className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    No orders match your filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <React.Fragment key={order.id}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedOrderId === order.id ? 'bg-gray-50' : ''}`}
                      onClick={() => toggleExpand(order.id)}
                    >
                      <td className="py-4 pl-4 pr-3 sm:pl-6">
                        <div className="text-gray-400 transition-transform duration-200" style={{ transform: expandedOrderId === order.id ? 'rotate(90deg)' : 'none' }}>
                          <ChevronRight size={18} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-4 pl-0 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-500" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-xs uppercase">#{order.id.split('-')[0]}</div>
                            <div className="text-gray-500 text-xs">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
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
                        {order.awb_number ? (
                          // Shadowfax-managed: show badge only, no dropdown
                          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusStyles(order.status)}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 mr-1.5"></span>
                            {statusOptions.find(o => o.value === order.status)?.label || order.status}
                            <span className="ml-1.5 text-[9px] opacity-50 font-normal">AUTO</span>
                          </div>
                        ) : (
                          // Manual dropdown for non-dispatched orders
                          <div className="relative inline-block w-36">
                            <select
                              value={order.status}
                              onChange={e => handleStatusChange(order, e.target.value)}
                              disabled={updatingId === order.id}
                              className={`appearance-none w-full outline-none cursor-pointer pl-3 pr-8 py-1.5 rounded-full text-xs font-semibold capitalize border border-transparent hover:border-gray-200 transition-all ${getStatusStyles(order.status)} ${updatingId === order.id ? 'opacity-50' : ''}`}
                            >
                              {statusOptions.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-white text-gray-900">{opt.label}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                              {updatingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={14} className="opacity-70" />}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {order.awb_number ? (
                          <div>
                            <div className="font-mono text-xs font-bold text-blue-700">{order.awb_number}</div>
                            {order.shadowfax_status && (() => {
                              const s = sfxStatusLabel(order.shadowfax_status)
                              return s ? <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${s.color}`}>{s.label}</span> : null
                            })()}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not dispatched</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-900 text-right pr-6">
                        {formatCurrency(order.total_amount)}
                      </td>
                    </tr>

                    {/* Expanded Row */}
                    {expandedOrderId === order.id && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/80 px-4 py-5 border-b border-gray-200">
                          <div className="max-w-5xl mx-auto space-y-4">

                            {/* ─── Shadowfax Command Center ─── */}
                            <div className={`rounded-xl border-2 p-5 ${order.awb_number ? 'border-blue-200 bg-blue-50/50' : 'border-dashed border-gray-300 bg-white'}`}>
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${order.awb_number ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    <Truck size={22} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-900 text-sm">Shadowfax Dispatch</p>
                                    {order.awb_number ? (
                                      <>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className="text-xs text-gray-500">AWB:</span>
                                          <span className="font-mono font-bold text-blue-700 text-sm">{order.awb_number}</span>
                                          <button
                                            onClick={() => navigator.clipboard.writeText(order.awb_number!)}
                                            className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold hover:bg-blue-200 transition-colors"
                                          >COPY</button>
                                        </div>
                                        {order.shadowfax_status && (() => {
                                          const s = sfxStatusLabel(order.shadowfax_status)
                                          return s ? (
                                            <div className="flex items-center gap-1.5 mt-1">
                                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.color}`}>{s.label}</span>
                                              <span className="text-xs text-gray-400">via Shadowfax webhook</span>
                                            </div>
                                          ) : null
                                        })()}
                                        {order.dispatched_at && (
                                          <p className="text-xs text-gray-400 mt-1">Dispatched {new Date(order.dispatched_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                        )}
                                        <p className="text-xs text-green-600 font-semibold mt-1.5">✓ Status updates automatically via Shadowfax webhook</p>
                                      </>
                                    ) : (
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {order.status === 'paid' ? 'Ready to dispatch — click the button to generate AWB' : `Order must be "Paid" to dispatch (currently: ${order.status})`}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2">
                                  {order.awb_number && (
                                    <>
                                      <button
                                        onClick={() => openShippingLabel(order.id)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors"
                                      >
                                        <Printer size={14} />
                                        Print Label
                                      </button>
                                      <a
                                        href={`https://shadowfax.in/tracking/${order.awb_number}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                                      >
                                        <ExternalLink size={14} />
                                        Track on Shadowfax
                                      </a>
                                    </>
                                  )}
                                  {!order.awb_number && order.status === 'paid' && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setDispatchOrder(order); setDispatchError(null); setDispatchSuccess(null) }}
                                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
                                    >
                                      <Send size={14} />
                                      Dispatch via Shadowfax
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* ─── Shipping + Items Grid ─── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                  <MapPin size={13} /> Shipping Details
                                </h3>
                                <div className="space-y-2 text-sm text-gray-700">
                                  <p className="font-bold text-gray-900 text-base">{order.customer_name}</p>
                                  <p className="flex items-center gap-2 text-[#e3231c] font-semibold">
                                    <Phone size={13} />{order.customer_phone || '—'}
                                  </p>
                                  {(() => {
                                    const addr = parseAddress(order.shipping_address)
                                    return addr ? (
                                      <div className="pt-2 border-t border-gray-100 space-y-0.5">
                                        <p>{addr.addressLine1 || addr.address}</p>
                                        <p>{addr.city}{addr.state ? `, ${addr.state}` : ''}</p>
                                        <p className="font-bold text-gray-900">PIN: {addr.pincode}</p>
                                      </div>
                                    ) : <p className="text-red-500 italic">No address</p>
                                  })()}
                                </div>
                              </div>

                              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                  <ShoppingBag size={13} /> Order Items
                                </h3>
                                <div className="space-y-3">
                                  {order.retail_order_items?.length > 0 ? order.retail_order_items.map(item => (
                                    <div key={item.id} className="flex gap-3 items-center pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                                      {item.products && (Array.isArray(item.products) ? item.products[0] : item.products)?.primary_image_url ? (
                                        <img src={(Array.isArray(item.products) ? item.products[0] : item.products).primary_image_url} alt={item.product_name} className="w-11 h-11 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                                      ) : (
                                        <div className="w-11 h-11 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                                          <Package className="h-4 w-4 text-gray-300" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
                                        <p className="text-xs text-gray-400">Qty: {item.quantity}{item.selected_color ? ` · ${item.selected_color}` : ''}</p>
                                      </div>
                                      <p className="text-sm font-bold text-gray-900 flex-shrink-0">{formatCurrency(Number(item.price_at_time) * item.quantity)}</p>
                                    </div>
                                  )) : <p className="text-sm text-gray-400 italic">No items.</p>}
                                </div>
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

      {/* ─── Dispatch Modal ─── */}
      {dispatchOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { if (!dispatching) { setDispatchOrder(null); setDispatchSuccess(null) } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <Send size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">Dispatch via Shadowfax</h2>
                  <p className="text-blue-200 text-xs">Order #{dispatchOrder.id.split('-')[0].toUpperCase()}</p>
                </div>
              </div>
              {!dispatching && !dispatchSuccess && (
                <button onClick={() => setDispatchOrder(null)} className="text-white/60 hover:text-white">
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {dispatchSuccess ? (
                // Success State
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Dispatched Successfully!</h3>
                  <p className="text-sm text-gray-500 mb-4">Your order is now with Shadowfax.</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                    <p className="text-xs text-blue-600 font-semibold uppercase tracking-widest mb-1">AWB Number</p>
                    <p className="text-2xl font-mono font-black text-blue-700">{dispatchSuccess}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => openShippingLabel(dispatchOrder.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black transition-colors"
                    >
                      <Printer size={14} /> Print Label
                    </button>
                    <button
                      onClick={() => { setDispatchOrder(null); setDispatchSuccess(null) }}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                // Form State
                <>
                  {/* Customer Preview */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Delivering to</p>
                    <p className="font-bold text-gray-900">{dispatchOrder.customer_name}</p>
                    <p className="text-sm text-gray-500">{dispatchOrder.customer_phone}</p>
                    {(() => {
                      const addr = parseAddress(dispatchOrder.shipping_address)
                      return addr ? <p className="text-sm text-gray-500">{addr.addressLine1}, {addr.city} — {addr.pincode}</p> : null
                    })()}
                  </div>

                  {/* Weight Input */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Package Weight (kg)</label>
                    <div className="relative">
                      <input
                        type="number" step="0.1" min="0.1"
                        value={dispatchWeightKg}
                        onChange={e => setDispatchWeightKg(e.target.value)}
                        className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                        placeholder="0.5"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold">kg</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Default 0.5 kg. Enter the actual package weight.</p>
                  </div>

                  {/* Warning for COD */}
                  {dispatchOrder.payment_method === 'cod' && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 font-semibold">
                        COD order — Shadowfax will collect ₹{Number(dispatchOrder.total_amount).toLocaleString('en-IN')} from the customer.
                      </p>
                    </div>
                  )}

                  {dispatchError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600">{dispatchError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setDispatchOrder(null)}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDispatch}
                      disabled={dispatching}
                      className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-200"
                    >
                      {dispatching ? <><Loader2 size={14} className="animate-spin" />Dispatching...</> : <><Send size={14} />Confirm Dispatch</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
