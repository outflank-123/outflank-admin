"use client"

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Clock, CheckCircle2, XCircle, Package, Truck, Loader2,
  ChevronDown, ChevronRight, Search, MapPin, Phone, ShoppingBag,
  Send, X, Printer, ExternalLink, RefreshCw, AlertTriangle,
  Navigation, PackageCheck, Ban, Wifi, WifiOff, PackageSearch,
  Sparkles, Download, Copy, Check, Eye, MessageCircle, FileText,
  ShieldCheck, Mail, ArrowUpRight
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export interface CustomizationData {
  is_customized?: boolean
  isCustomized?: boolean
  brand_text?: string
  brandText?: string
  text?: string
  text_color?: string
  textColor?: string
  logo_url?: string
  logoUrl?: string
  logo_storage_path?: string
  logoStoragePath?: string
  file_size_bytes?: number
  fileSizeBytes?: number
  file_size_kb?: string
  fileSizeKb?: string
  print_position?: string
  printPosition?: string
  customization_label?: string
  customizationLabel?: string
  asset_status?: string
  coordinates?: {
    left: string
    top: string
    width: string
  }
}

interface OrderItem {
  id: string
  product_name: string
  quantity: number
  price_at_time: number
  selected_color: string | null
  products?: any
  customization?: CustomizationData | null
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
  notes?: string | null
  delivered_at?: string | null
  assets_purged?: boolean | null
  retail_order_items: OrderItem[]
}

export function getItemCustomization(item: OrderItem, order: Order): CustomizationData | null {
  if (item.customization && (item.customization.is_customized || item.customization.isCustomized || item.customization.logo_url || item.customization.logoUrl || item.customization.brand_text || item.customization.brandText)) {
    return item.customization
  }
  if (order.notes) {
    try {
      const parsed = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes
      if (parsed.custom_items) {
        const found = parsed.custom_items.find((ci: any) => ci.product_name === item.product_name)
        if (found?.customization) return found.customization
      }
    } catch {}
  }
  if (item.selected_color && item.selected_color.includes('Custom')) {
    const match = item.selected_color.match(/\[Custom:?\s*"?([^"\]]+)"?\]/i)
    return {
      is_customized: true,
      brand_text: match ? match[1] : undefined,
      customization_label: item.selected_color
    }
  }
  return null
}

export function hasCustomItems(order: Order): boolean {
  return order.retail_order_items?.some(item => Boolean(getItemCustomization(item, order))) || false
}

// Parse address from JSON string or object
function parseAddress(raw: any) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { 
    // Fallback for old string addresses: try to extract pincode from the end
    const match = raw.match(/-?\\s*(\\d{6})$/)
    const pincode = match ? match[1] : ''
    return { addressLine1: raw, pincode } 
  }
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
  const [liveStatus, setLiveStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting')
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [dateFilter, setDateFilter] = useState('all_time')

  // Dispatch modal
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null)
  const [dispatchWeightKg, setDispatchWeightKg] = useState('0.5')
  const [dispatchLength, setDispatchLength] = useState('15')
  const [dispatchWidth, setDispatchWidth] = useState('10')
  const [dispatchHeight, setDispatchHeight] = useState('5')
  const [dispatching, setDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null)

  // Custom Print Job Sheet & Download State
  const [jobCardOrder, setJobCardOrder] = useState<Order | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null)

  const downloadLogo = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename || 'custom_logo.webp'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const router = useRouter()

  // ── Supabase Realtime: auto-refresh orders table ─────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('retail_orders_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'retail_orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // New order placed — refresh the page data
            setNewOrderAlert(`New order received!`)
            setTimeout(() => setNewOrderAlert(null), 6000)
            router.refresh()
          } else if (payload.eventType === 'UPDATE') {
            // Status update (e.g. from Shadowfax webhook) — update in-place
            setOrders(prev => prev.map(o =>
              o.id === payload.new.id ? { ...o, ...payload.new } : o
            ))
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLiveStatus('connected')
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setLiveStatus('disconnected')
        else setLiveStatus('connecting')
      })

    return () => { supabase.removeChannel(channel) }
  }, [router])
  // ─────────────────────────────────────────────────────────────────────────────

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
        body: JSON.stringify({ 
          orderId: dispatchOrder.id, 
          weightKg: parseFloat(dispatchWeightKg),
          dimensions: `${dispatchLength}x${dispatchWidth}x${dispatchHeight}`
        }),
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

  // Used for rendering the status pill
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

  // Used for the top filter tabs
  const tabOptions = [
    { value: 'all', label: 'All Orders', icon: PackageSearch },
    { value: 'custom_print', label: 'Custom Print Orders', icon: Sparkles },
    { value: 'to_dispatch', label: 'Action Required', icon: Truck },
    { value: 'awaiting_payment', label: 'Awaiting Payment', icon: Clock },
    { value: 'shipped', label: 'Shipped / Out for Delivery', icon: Navigation },
    { value: 'delivered', label: 'Delivered', icon: PackageCheck },
    { value: 'failed_cancelled', label: 'Failed / Cancelled', icon: Ban },
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

  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return baseFilteredOrders;
    
    return baseFilteredOrders.filter(o => {
      if (activeTab === 'custom_print') return hasCustomItems(o)
      if (activeTab === 'to_dispatch') return (o.status === 'pending' && o.payment_method === 'cod') || o.status === 'paid'
      if (activeTab === 'awaiting_payment') return o.status === 'pending' && o.payment_method !== 'cod'
      if (activeTab === 'shipped') return o.status === 'shipped' || o.status === 'out_for_delivery'
      if (activeTab === 'delivered') return o.status === 'delivered'
      if (activeTab === 'failed_cancelled') return o.status === 'failed' || o.status === 'cancelled'
      return false
    })
  }, [baseFilteredOrders, activeTab])

  const tabs = tabOptions

  return (
    <div className="space-y-6">

      {/* New Order Alert Banner */}
      {newOrderAlert && (
        <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium text-sm">
          <Package size={16} className="text-emerald-600 shrink-0" />
          <span>🎉 {newOrderAlert} The table has been refreshed.</span>
        </div>
      )}

      {/* Filter Header */}
      <div className="bg-white p-4 shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Live Connection Status */}
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
              liveStatus === 'connected' ? 'bg-emerald-50 text-emerald-700' :
              liveStatus === 'disconnected' ? 'bg-red-50 text-red-700' :
              'bg-amber-50 text-amber-700'
            }`}>
              {liveStatus === 'connected' ? <Wifi size={12} /> : liveStatus === 'disconnected' ? <WifiOff size={12} /> : <Loader2 size={12} className="animate-spin" />}
              {liveStatus === 'connected' ? 'Live' : liveStatus === 'disconnected' ? 'Offline' : 'Connecting'}
            </div>
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
            let count = 0
            if (tab.value === 'all') count = baseFilteredOrders.length
            else if (tab.value === 'to_dispatch') count = baseFilteredOrders.filter(o => (o.status === 'pending' && o.payment_method === 'cod') || o.status === 'paid').length
            else if (tab.value === 'awaiting_payment') count = baseFilteredOrders.filter(o => o.status === 'pending' && o.payment_method !== 'cod').length
            else if (tab.value === 'shipped') count = baseFilteredOrders.filter(o => o.status === 'shipped' || o.status === 'out_for_delivery').length
            else if (tab.value === 'delivered') count = baseFilteredOrders.filter(o => o.status === 'delivered').length
            else if (tab.value === 'failed_cancelled') count = baseFilteredOrders.filter(o => o.status === 'failed' || o.status === 'cancelled').length

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.value ? 'bg-black text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'} ${tab.value === 'to_dispatch' && activeTab !== 'to_dispatch' && count > 0 ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${activeTab === tab.value ? 'bg-gray-800 text-gray-200' : 'bg-gray-200 text-gray-600'} ${tab.value === 'to_dispatch' && count > 0 ? '!bg-red-500 !text-white' : ''}`}>{count}</span>
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
                            <div className="font-medium text-gray-900 text-xs uppercase flex items-center gap-1.5">
                              <span>#{order.id.split('-')[0]}</span>
                              {hasCustomItems(order) && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-[#0066FF] border border-blue-200">
                                  <Sparkles size={10} /> CUSTOM PRINT
                                </span>
                              )}
                            </div>
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

                    {/* Expanded Row - Redesigned High-End Production & Logistics Hub */}
                    {expandedOrderId === order.id && (
                      <tr>
                        <td colSpan={7} className="bg-[#f8f9fb] px-3 sm:px-6 py-5 border-b border-gray-200">
                          <div className="max-w-6xl mx-auto bg-white rounded-2xl border border-gray-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">

                            {/* ── 1. Top Order Command Strip ── */}
                            <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-mono font-bold text-xs text-white">
                                  #{order.id.slice(0, 6).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm tracking-tight text-white">Order Details</span>
                                    {hasCustomItems(order) && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0066FF] text-white">
                                        <Sparkles size={10} /> Bespoke Apparel Customization
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-gray-400">
                                    Placed on {new Date(order.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid (Razorpay)'}
                                  </p>
                                </div>
                              </div>

                              {/* Top Quick Actions */}
                              <div className="flex items-center gap-2">
                                {hasCustomItems(order) && (
                                  <button
                                    type="button"
                                    onClick={() => setJobCardOrder(order)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer border border-white/15"
                                  >
                                    <Printer size={13} />
                                    <span>Print Job Sheet</span>
                                  </button>
                                )}
                                <a
                                  href={`/invoice/${order.id}?print=true`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/15"
                                >
                                  <FileText size={13} />
                                  <span>Print Invoice</span>
                                </a>
                              </div>
                            </div>

                            {/* ── 2. Master Split: Left (Production & Customization) vs Right (Logistics & Delivery) ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

                              {/* ══ LEFT: Production & Items (7 Columns) ══ */}
                              <div className="lg:col-span-7 p-5 sm:p-6 space-y-6">
                                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                    <ShoppingBag size={14} className="text-gray-700" />
                                    <span>Garments & Production Specifications</span>
                                    <span className="text-[11px] font-semibold text-gray-400">({order.retail_order_items?.length || 0} items)</span>
                                  </h3>
                                  <span className="text-xs font-bold text-gray-900">
                                    Total: {formatCurrency(order.total_amount)}
                                  </span>
                                </div>

                                <div className="space-y-6">
                                  {order.retail_order_items?.map((item, idx) => {
                                    const custom = getItemCustomization(item, order)
                                    const logoUrl = custom?.logo_url || custom?.logoUrl
                                    const brandText = custom?.brand_text || custom?.brandText || custom?.text
                                    const textColor = custom?.text_color || custom?.textColor || '#FFFFFF'
                                    const rawPlacement = custom?.print_position || custom?.printPosition || 'Front Center Chest'
                                    const cleanPlacement = rawPlacement.replace(/\s*\([^)]*\)$/, '').trim()
                                    const isPurged = order.assets_purged || custom?.asset_status === 'purged_after_14_days'
                                    const garmentImg = (Array.isArray(item.products) ? item.products[0] : item.products)?.primary_image_url

                                    return (
                                      <div key={item.id} className="rounded-xl border border-gray-200/90 bg-white overflow-hidden shadow-2xs">
                                        
                                        {/* Item Title Bar */}
                                        <div className="p-4 bg-slate-50/70 border-b border-gray-100 flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-3">
                                            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                              {idx + 1}
                                            </span>
                                            <div>
                                              <p className="text-sm font-bold text-gray-900 leading-snug">{item.product_name}</p>
                                              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                                <span>Qty: <strong className="text-gray-800">{item.quantity}</strong></span>
                                                {item.selected_color && (
                                                  <>
                                                    <span>•</span>
                                                    <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                                                      Color: <strong>{item.selected_color}</strong>
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <span className="text-sm font-bold text-gray-900">
                                            {formatCurrency(Number(item.price_at_time) * item.quantity)}
                                          </span>
                                        </div>

                                        {/* Customization Workshop Section */}
                                        {custom ? (
                                          <div className="p-4 sm:p-5 bg-white space-y-4">
                                            
                                            {/* Studio Banner */}
                                            <div className="flex items-center justify-between bg-blue-50/60 border border-blue-100/90 rounded-lg px-3 py-2">
                                              <div className="flex items-center gap-2">
                                                <Sparkles size={13} className="text-[#0066FF]" />
                                                <span className="text-xs font-bold text-[#0066FF] uppercase tracking-wide">
                                                  Custom Branding Studio Imprint
                                                </span>
                                              </div>
                                              <span className="text-xs font-semibold text-gray-700">
                                                Placement: <strong className="text-gray-900">{cleanPlacement}</strong>
                                              </span>
                                            </div>

                                            {/* Visual Garment Mockup + Specs Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                                              
                                              {/* ── Interactive Garment Placement Preview (5 cols) ── */}
                                              <div className="sm:col-span-5 flex flex-col items-center">
                                                <div 
                                                  onClick={() => garmentImg && setLightboxImage({ url: garmentImg, title: `${item.product_name} - ${item.selected_color || ''}` })}
                                                  className="relative w-full aspect-square max-w-[200px] rounded-xl bg-slate-50 border border-gray-200 overflow-hidden flex items-center justify-center cursor-pointer group shadow-2xs hover:shadow-xs transition-all"
                                                  title="Click to view garment preview"
                                                >
                                                  {garmentImg ? (
                                                    <img 
                                                      src={garmentImg} 
                                                      alt={item.product_name} 
                                                      className="w-full h-full object-contain p-2" 
                                                    />
                                                  ) : (
                                                    <Package className="w-12 h-12 text-gray-300" />
                                                  )}

                                                  {/* Logo overlay positioned at exact customer coordinates */}
                                                  {logoUrl && (
                                                    <div
                                                      className="absolute pointer-events-none transition-transform group-hover:scale-105"
                                                      style={{
                                                        left: custom.coordinates?.left || '50%',
                                                        top: custom.coordinates?.top || '49%',
                                                        width: custom.coordinates?.width || '22%',
                                                        transform: 'translate(-50%, -50%)',
                                                      }}
                                                    >
                                                      <img 
                                                        src={logoUrl} 
                                                        alt="Logo Preview" 
                                                        className="w-full h-auto object-contain drop-shadow-xs" 
                                                      />
                                                    </div>
                                                  )}

                                                  {/* Brand text overlay */}
                                                  {brandText && (
                                                    <div
                                                      className="absolute pointer-events-none text-center font-bold font-sans transition-transform group-hover:scale-105"
                                                      style={{
                                                        left: custom.coordinates?.left || '50%',
                                                        top: custom.coordinates?.top || '49%',
                                                        color: textColor,
                                                        transform: 'translate(-50%, -50%)',
                                                        fontSize: '11px',
                                                        maxWidth: '45%',
                                                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                                      }}
                                                    >
                                                      {brandText}
                                                    </div>
                                                  )}

                                                  {/* Hover badge */}
                                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent py-1.5 px-2 flex items-center justify-between text-white text-[10px] font-medium opacity-90 group-hover:opacity-100 transition-opacity">
                                                    <span className="flex items-center gap-1 font-semibold">
                                                      <Eye size={10} /> Live Mockup
                                                    </span>
                                                    <span className="font-mono text-[9px] text-gray-200">
                                                      {custom.coordinates ? `${custom.coordinates.left}, ${custom.coordinates.top}` : 'Center'}
                                                    </span>
                                                  </div>
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-1 font-medium">Customer Placement Preview</span>
                                              </div>

                                              {/* ── Artwork & Asset Specifications (7 cols) ── */}
                                              <div className="sm:col-span-7 space-y-3">
                                                
                                                {/* If Uploaded Logo */}
                                                {logoUrl ? (
                                                  <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                                        Production Artwork File
                                                      </span>
                                                      <span className="text-[9px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                                                        WebP Print Ready (&lt;20KB)
                                                      </span>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                      {/* Logo Thumbnail with checkerboard background */}
                                                      <div
                                                        onClick={() => setLightboxImage({ url: logoUrl, title: `Order ${order.id.split('-')[0].toUpperCase()} Logo Artwork` })}
                                                        className="w-14 h-14 rounded-lg border border-gray-300 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-black transition-colors"
                                                        style={{
                                                          backgroundImage: 'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
                                                          backgroundSize: '8px 8px',
                                                          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
                                                        }}
                                                        title="Click to view full size"
                                                      >
                                                        <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                                                      </div>

                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-gray-900 truncate">Customer Logo Graphic</p>
                                                        <p className="text-[10px] text-gray-500">Alpha channel transparency preserved</p>
                                                        {custom.file_size_kb && (
                                                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Size: {custom.file_size_kb} KB</p>
                                                        )}
                                                      </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-2 pt-1 border-t border-gray-200/60">
                                                      <button
                                                        type="button"
                                                        onClick={() => downloadLogo(logoUrl, `Order_${order.id.split('-')[0]}_logo.webp`)}
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                                      >
                                                        <Download size={13} />
                                                        <span>Download Print File</span>
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => setLightboxImage({ url: logoUrl, title: `Order ${order.id.split('-')[0].toUpperCase()} Logo Artwork` })}
                                                        className="px-2.5 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                        title="Inspect full screen"
                                                      >
                                                        <Eye size={13} />
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : null}

                                                {/* If Brand Text */}
                                                {brandText ? (
                                                  <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                                        Custom Text to Imprint
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(brandText, `${item.id}-text`)}
                                                        className="text-[10px] font-bold text-[#0066FF] hover:underline flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded cursor-pointer"
                                                      >
                                                        {copiedId === `${item.id}-text` ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy Text</>}
                                                      </button>
                                                    </div>
                                                    <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 flex items-center justify-between">
                                                      <span className="font-mono font-bold text-sm text-gray-900">&ldquo;{brandText}&rdquo;</span>
                                                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                        <span className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: textColor }} />
                                                        <span className="font-mono font-bold text-[10px]">{textColor}</span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : null}

                                                {/* Technical Placement Telemetry */}
                                                {custom.coordinates && (
                                                  <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200/80">
                                                    <span className="font-sans font-bold text-gray-700 uppercase">Telemetry:</span>
                                                    <span>X: <strong>{custom.coordinates.left}</strong></span>
                                                    <span>•</span>
                                                    <span>Y: <strong>{custom.coordinates.top}</strong></span>
                                                    <span>•</span>
                                                    <span>Scale: <strong>{custom.coordinates.width}</strong></span>
                                                  </div>
                                                )}

                                              </div>
                                            </div>

                                            {/* Privacy Policy Retention Status */}
                                            <div className="flex items-center justify-between text-[11px] pt-2 text-gray-500 border-t border-gray-100">
                                              <span className="flex items-center gap-1.5 font-medium">
                                                <ShieldCheck size={13} className={isPurged ? 'text-gray-400' : 'text-emerald-600'} />
                                                {isPurged ? (
                                                  <span className="text-gray-500">Asset purged per 14-day data retention policy</span>
                                                ) : order.status === 'delivered' ? (
                                                  <span className="text-amber-700">Delivered · 14-day asset retention countdown active</span>
                                                ) : (
                                                  <span className="text-emerald-700">Print asset active · Auto-purged 14 days after delivery</span>
                                                )}
                                              </span>
                                            </div>

                                          </div>
                                        ) : (
                                          <div className="p-3 text-xs text-gray-400 italic bg-gray-50/50">
                                            Standard non-customized product
                                          </div>
                                        )}

                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* ══ RIGHT: Logistics & Customer (5 Columns) ══ */}
                              <div className="lg:col-span-5 p-5 sm:p-6 bg-slate-50/40 space-y-5">
                                
                                {/* ── A. Shadowfax Express Logistics Card ── */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                                  <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Truck size={15} className="text-blue-400" />
                                      <span className="font-bold text-xs uppercase tracking-wide">Shadowfax Logistics</span>
                                    </div>
                                    {order.awb_number && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-400/30">
                                        SURFACE EXPRESS
                                      </span>
                                    )}
                                  </div>

                                  <div className="p-4 space-y-3">
                                    {order.awb_number ? (
                                      <>
                                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                          <div>
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">AWB Tracking Number</span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                              <span className="font-mono font-bold text-blue-700 text-sm">{order.awb_number}</span>
                                              <button
                                                type="button"
                                                onClick={() => copyToClipboard(order.awb_number!, `${order.id}-awb`)}
                                                className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer"
                                              >
                                                {copiedId === `${order.id}-awb` ? 'Copied' : 'Copy'}
                                              </button>
                                            </div>
                                          </div>
                                          {order.shadowfax_status && (() => {
                                            const s = sfxStatusLabel(order.shadowfax_status)
                                            return s ? (
                                              <span className={`text-xs px-2.5 py-1 rounded-full font-bold shadow-2xs ${s.color}`}>
                                                {s.label}
                                              </span>
                                            ) : null
                                          })()}
                                        </div>

                                        {order.dispatched_at && (
                                          <p className="text-[11px] text-gray-500">
                                            Dispatched: {new Date(order.dispatched_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                        )}

                                        <div className="flex items-center gap-2 pt-1">
                                          <button
                                            type="button"
                                            onClick={() => openShippingLabel(order.id)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                                          >
                                            <Printer size={13} />
                                            <span>Shipping Label</span>
                                          </button>
                                          <a
                                            href={`https://shadowfax.in/tracking/${order.awb_number}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
                                          >
                                            <ExternalLink size={13} />
                                            <span>Track Courier</span>
                                          </a>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex items-start gap-3">
                                          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                            <PackageCheck size={20} />
                                          </div>
                                          <div>
                                            <p className="text-xs font-bold text-gray-900">Package Ready for Carrier</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                              {['pending', 'processing', 'paid', 'shipped'].includes(order.status)
                                                ? 'Generate Shadowfax AWB and schedule instant courier pickup.'
                                                : `Order status is currently ${order.status}.`}
                                            </p>
                                          </div>
                                        </div>

                                        {['pending', 'processing', 'paid', 'shipped'].includes(order.status) && (
                                          <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); setDispatchOrder(order); setDispatchError(null); setDispatchSuccess(null) }}
                                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0066FF] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-200 cursor-pointer"
                                          >
                                            <Send size={13} />
                                            <span>Dispatch via Shadowfax</span>
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* ── B. Customer & Delivery Address Card ── */}
                                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 shadow-2xs">
                                  
                                  {/* Customer Info */}
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
                                      Customer Profile
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-800 font-bold text-sm flex items-center justify-center border border-gray-200 shrink-0">
                                        {order.customer_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'CU'}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-900 truncate">{order.customer_name}</p>
                                        <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                                          <Mail size={11} /> {order.customer_email || '—'}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Quick Contact Actions: WhatsApp & Call */}
                                    {order.customer_phone && (
                                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                                        <a
                                          href={`https://wa.me/91${order.customer_phone.replace(/\D/g, '')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200/80"
                                        >
                                          <MessageCircle size={13} />
                                          <span>WhatsApp</span>
                                        </a>
                                        <a
                                          href={`tel:${order.customer_phone}`}
                                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold transition-colors border border-gray-200"
                                        >
                                          <Phone size={13} />
                                          <span>{order.customer_phone}</span>
                                        </a>
                                      </div>
                                    )}
                                  </div>

                                  {/* Delivery Address */}
                                  <div className="pt-3 border-t border-gray-100">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2 flex items-center gap-1">
                                      <MapPin size={11} /> Shipping Destination
                                    </span>
                                    {(() => {
                                      const addr = parseAddress(order.shipping_address)
                                      return addr ? (
                                        <div className="space-y-1 text-xs text-gray-700">
                                          <p className="font-medium leading-relaxed">{addr.addressLine1 || addr.address}</p>
                                          {(addr.city || addr.state) && (
                                            <p className="text-gray-500 font-medium">
                                              {addr.city}{addr.state ? `, ${addr.state}` : ''}
                                            </p>
                                          )}
                                          {addr.pincode && (
                                            <div className="pt-1.5">
                                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-gray-900 text-white font-mono font-bold text-[11px]">
                                                PIN: {addr.pincode}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-red-500 italic">No delivery address provided</p>
                                      )
                                    })()}
                                  </div>

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

                  {/* Weight & Dimensions Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Package Weight & Dimensions</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Weight (kg)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={dispatchWeightKg}
                            onChange={(e) => setDispatchWeightKg(e.target.value)}
                            className="block w-full rounded-lg border-gray-300 py-3 px-4 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="0.5"
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-500 sm:text-sm">kg</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Dimensions L×W×H (cm)</label>
                        <div className="flex gap-2">
                          <input type="number" value={dispatchLength} onChange={e => setDispatchLength(e.target.value)} className="block w-full rounded-lg border-gray-300 py-3 px-2 text-center text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="L" />
                          <input type="number" value={dispatchWidth} onChange={e => setDispatchWidth(e.target.value)} className="block w-full rounded-lg border-gray-300 py-3 px-2 text-center text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="W" />
                          <input type="number" value={dispatchHeight} onChange={e => setDispatchHeight(e.target.value)} className="block w-full rounded-lg border-gray-300 py-3 px-2 text-center text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="H" />
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">Enter the actual package weight and dimensions.</p>
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

      {/* ─── Production Job Card Modal ─── */}
      {jobCardOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:p-0" onClick={() => setJobCardOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden print:w-full print:max-w-none print:shadow-none print:rounded-none" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between print:bg-black">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                  <Printer size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-base tracking-wide uppercase">Apparel Production Job Sheet</h2>
                  <p className="text-gray-400 text-xs font-mono">Order #{jobCardOrder.id.split('-')[0].toUpperCase()} · {new Date(jobCardOrder.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <button onClick={() => setJobCardOrder(null)} className="text-gray-400 hover:text-white print:hidden">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5 text-gray-900">
              {/* Order & Customer Summary */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="font-bold uppercase tracking-wider text-gray-400 block mb-1">Customer / Consignee</span>
                  <p className="font-bold text-sm text-gray-900">{jobCardOrder.customer_name}</p>
                  <p className="text-gray-600">{jobCardOrder.customer_phone}</p>
                  <p className="text-gray-600">{jobCardOrder.customer_email}</p>
                </div>
                <div>
                  <span className="font-bold uppercase tracking-wider text-gray-400 block mb-1">Order Status</span>
                  <p className="font-bold text-sm text-gray-900 uppercase">{jobCardOrder.status}</p>
                  <p className="text-gray-600">Payment: {jobCardOrder.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid (Razorpay)'}</p>
                  {jobCardOrder.awb_number && <p className="font-mono text-blue-700">AWB: {jobCardOrder.awb_number}</p>}
                </div>
              </div>

              {/* Garment Line Items & Custom Imprints */}
              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 border-b pb-1">Garments to Brand & Print</h4>
                {jobCardOrder.retail_order_items.map((item, idx) => {
                  const custom = getItemCustomization(item, jobCardOrder)
                  const logoUrl = custom?.logo_url || custom?.logoUrl
                  const brandText = custom?.brand_text || custom?.brandText || custom?.text
                  const textColor = custom?.text_color || custom?.textColor || '#FFFFFF'

                  return (
                    <div key={item.id} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-xs font-bold text-gray-400">ITEM #{idx + 1}</span>
                          <h5 className="font-bold text-base text-gray-900">{item.product_name}</h5>
                          <p className="text-xs text-gray-600 font-medium">Color: <strong>{item.selected_color || 'Standard'}</strong> · Quantity: <strong className="text-gray-900 text-sm">{item.quantity} units</strong></p>
                        </div>
                        <span className="px-2 py-1 rounded bg-blue-50 text-[#0066FF] border border-blue-200 text-xs font-bold uppercase">
                          Placement: {custom?.print_position || custom?.printPosition || 'Left Chest'}
                        </span>
                      </div>

                      {/* Imprint Artwork */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                        {brandText && (
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Text Imprint</span>
                            <p className="font-bold text-lg font-mono text-gray-900">"{brandText}"</p>
                            <div className="flex items-center gap-1.5 mt-1 text-xs">
                              <span>Color:</span>
                              <span className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: textColor }} />
                              <span className="font-mono font-bold">{textColor}</span>
                            </div>
                          </div>
                        )}

                        {logoUrl ? (
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center gap-3">
                            <div
                              className="w-16 h-16 rounded border border-gray-300 flex items-center justify-center bg-white overflow-hidden shrink-0"
                              style={{
                                backgroundImage: 'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
                                backgroundSize: '8px 8px',
                                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
                              }}
                            >
                              <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Print Logo Graphic</span>
                              <span className="text-xs font-bold text-gray-900">WebP High-Res (&lt;20KB)</span>
                              <span className="text-[10px] text-gray-500 block">Alpha Channel Preserved</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center text-xs text-gray-500">
                            <span>No Logo Graphic Attached</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Quality Checklist & Operator Sign-off */}
              <div className="border-t pt-4 flex justify-between items-center text-xs text-gray-500">
                <div className="space-y-1">
                  <p>✓ Garment Inspection Passed</p>
                  <p>✓ Logo Scaled to Print Template</p>
                  <p>✓ Imprint Color Match Verified</p>
                </div>
                <div className="text-right">
                  <div className="w-36 border-b border-gray-400 h-8 mb-1"></div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Operator Sign-Off</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md"
                >
                  <Printer size={16} /> Print Job Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setJobCardOrder(null)}
                  className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Image Inspection Lightbox Modal ─── */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-4 overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h4 className="font-bold text-sm text-gray-900">{lightboxImage.title}</h4>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div 
              className="flex items-center justify-center p-8 bg-slate-50 rounded-xl overflow-hidden min-h-[300px]"
              style={{
                backgroundImage: 'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
                backgroundSize: '12px 12px',
                backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0'
              }}
            >
              <img 
                src={lightboxImage.url} 
                alt={lightboxImage.title} 
                className="max-w-full max-h-[60vh] object-contain drop-shadow-md" 
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => downloadLogo(lightboxImage.url, `${lightboxImage.title.toLowerCase().replace(/\s+/g, '_')}.webp`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Download size={14} />
                <span>Download Print File</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
