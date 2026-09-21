'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Users, Search, Phone, Mail, MapPin, Building2, ShieldCheck,
  ExternalLink, MessageSquare, ShoppingBag, Download, ArrowUpDown,
  Filter, CheckCircle2, User, ChevronRight, X, Clock, Calendar,
  CreditCard, Truck, RefreshCw
} from 'lucide-react'
import { getAdminCache, setAdminCache } from '@/lib/adminCache'

export interface CustomerOrderSummary {
  id: string
  total_amount: number
  status: string
  created_at: string
  payment_method?: string
  awb_number?: string | null
}

export interface StorefrontCustomer {
  id: string
  firebaseUid?: string | null
  name: string
  email: string | null
  phone: string | null
  avatarUrl?: string | null
  authProvider: 'whatsapp' | 'google' | 'apple' | 'guest'
  ordersCount: number
  totalSpent: number
  lastOrderDate: string | null
  recentStatus: string | null
  registeredAt: string
  companyName?: string | null
  gstin?: string | null
  gender?: string | null
  shippingAddress?: {
    fullName?: string
    phone?: string
    email?: string
    houseNo?: string
    street?: string
    landmark?: string
    addressLine1?: string
    addressLine2?: string
    address?: string
    city?: string
    state?: string
    pincode?: string
    tag?: string
    companyName?: string
    gstin?: string
    gender?: string
  } | null
  orders?: CustomerOrderSummary[]
}

interface CustomersTableClientProps {
  initialCustomers: StorefrontCustomer[]
}

export default function CustomersTableClient({ initialCustomers }: CustomersTableClientProps) {
  const [customers, setCustomers] = useState<StorefrontCustomer[]>(() => {
    if (initialCustomers && initialCustomers.length > 0) return initialCustomers
    const cached = getAdminCache<StorefrontCustomer[]>('outflank_admin_customers', 10 * 60 * 1000, 'session')
    return cached?.data || initialCustomers
  })

  useEffect(() => {
    if (initialCustomers && initialCustomers.length > 0) {
      setCustomers(initialCustomers)
      setAdminCache('outflank_admin_customers', initialCustomers, 'session')
    }
  }, [initialCustomers])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'whatsapp' | 'google' | 'apple' | 'buyers' | 'address'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'spend_desc' | 'orders_desc' | 'name_asc'>('newest')
  const [selectedCustomer, setSelectedCustomer] = useState<StorefrontCustomer | null>(null)

  // Metrics
  const metrics = useMemo(() => {
    const total = customers.length
    const whatsappCount = customers.filter((c) => c.authProvider === 'whatsapp').length
    const googleCount = customers.filter((c) => c.authProvider === 'google').length
    const appleCount = customers.filter((c) => c.authProvider === 'apple').length
    const buyersCount = customers.filter((c) => c.ordersCount > 0).length
    const addressCount = customers.filter((c) => Boolean(c.shippingAddress?.address || c.shippingAddress?.city)).length
    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0)

    return { total, whatsappCount, googleCount, appleCount, buyersCount, addressCount, totalRevenue }
  }, [customers])

  // Filter & Search
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        // Tab Filter
        if (activeTab === 'whatsapp' && c.authProvider !== 'whatsapp') return false
        if (activeTab === 'google' && c.authProvider !== 'google') return false
        if (activeTab === 'apple' && c.authProvider !== 'apple') return false
        if (activeTab === 'buyers' && c.ordersCount === 0) return false
        if (activeTab === 'address' && !(c.shippingAddress?.address || c.shippingAddress?.city)) return false

        // Search Filter
        if (!searchQuery.trim()) return true
        const query = searchQuery.toLowerCase().trim()
        const matchName = (c.name || '').toLowerCase().includes(query)
        const matchEmail = (c.email || '').toLowerCase().includes(query)
        const matchPhone = (c.phone || '').replace(/\D/g, '').includes(query.replace(/\D/g, ''))
        const matchCity = (c.shippingAddress?.city || '').toLowerCase().includes(query)
        const matchState = (c.shippingAddress?.state || '').toLowerCase().includes(query)
        const matchCompany = (c.companyName || c.shippingAddress?.companyName || '').toLowerCase().includes(query)
        const matchGstin = (c.gstin || c.shippingAddress?.gstin || '').toLowerCase().includes(query)

        return matchName || matchEmail || matchPhone || matchCity || matchState || matchCompany || matchGstin
      })
      .sort((a, b) => {
        if (sortBy === 'spend_desc') return b.totalSpent - a.totalSpent
        if (sortBy === 'orders_desc') return b.ordersCount - a.ordersCount
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
        return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
      })
  }, [customers, searchQuery, activeTab, sortBy])

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Auth Provider', 'Orders Count', 'Total Spent (INR)', 'House / Street', 'Landmark', 'City', 'State', 'Pincode', 'Company', 'GSTIN', 'Joined Date']
    const rows = filteredCustomers.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone || ''}"`,
      `"${c.email || ''}"`,
      `"${c.authProvider}"`,
      c.ordersCount,
      c.totalSpent,
      `"${(c.shippingAddress?.addressLine1 || (c.shippingAddress?.houseNo ? `${c.shippingAddress.houseNo}, ${c.shippingAddress.street || ''}`.trim() : c.shippingAddress?.address) || '').replace(/"/g, '""')}"`,
      `"${(c.shippingAddress?.landmark || c.shippingAddress?.addressLine2 || '').replace(/"/g, '""')}"`,
      `"${(c.shippingAddress?.city || '').replace(/"/g, '""')}"`,
      `"${(c.shippingAddress?.state || '').replace(/"/g, '""')}"`,
      `"${(c.shippingAddress?.pincode || '').replace(/"/g, '""')}"`,
      `"${(c.companyName || c.shippingAddress?.companyName || '').replace(/"/g, '""')}"`,
      `"${(c.gstin || c.shippingAddress?.gstin || '').replace(/"/g, '""')}"`,
      `"${c.registeredAt}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `outflank_customers_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] flex items-center gap-2.5">
            <Users className="text-[#e3231c]" size={24} />
            Customer Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered storefront users, authentication records, saved delivery addresses, and customer lifetime value.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/broadcast"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <MessageSquare size={14} />
            <span>Send WhatsApp Broadcast</span>
          </Link>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-black/10 shadow-2xs transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── SUMMARY METRICS ROW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Customers</div>
          <div className="text-2xl font-black text-[#1d1d1f]">{metrics.total}</div>
          <div className="text-[10px] text-slate-500">Across all channels</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">WhatsApp Verified</div>
          <div className="text-2xl font-black text-emerald-600">{metrics.whatsappCount}</div>
          <div className="text-[10px] text-slate-500">Active phone verified</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Google / Apple</div>
          <div className="text-2xl font-black text-blue-600">{metrics.googleCount + metrics.appleCount}</div>
          <div className="text-[10px] text-slate-500">{metrics.googleCount} Google, {metrics.appleCount} Apple</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Buyers</div>
          <div className="text-2xl font-black text-[#1d1d1f]">{metrics.buyersCount}</div>
          <div className="text-[10px] text-slate-500">Placed 1+ orders</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saved Addresses</div>
          <div className="text-2xl font-black text-[#1d1d1f]">{metrics.addressCount}</div>
          <div className="text-[10px] text-slate-500">Fast checkout ready</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customer Revenue</div>
          <div className="text-xl font-black text-emerald-700 font-mono">
            ₹{metrics.totalRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500">Lifetime spend</div>
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ── */}
      <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, email, city, company, or GSTIN..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-[#fbfbfd] text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1d1d1f] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
              <ArrowUpDown size={12} /> Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-[#fbfbfd] text-xs font-semibold text-slate-700 outline-none cursor-pointer focus:border-[#1d1d1f]"
            >
              <option value="newest">Newest Joined</option>
              <option value="spend_desc">Highest Lifetime Spend</option>
              <option value="orders_desc">Most Orders</option>
              <option value="name_asc">Name A to Z</option>
            </select>
          </div>
        </div>

        {/* Filter Badges / Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 text-xs">
          {[
            { id: 'all', label: `All (${customers.length})` },
            { id: 'whatsapp', label: `WhatsApp Verified (${metrics.whatsappCount})` },
            { id: 'google', label: `Google (${metrics.googleCount})` },
            { id: 'apple', label: `Apple (${metrics.appleCount})` },
            { id: 'buyers', label: `Buyers (${metrics.buyersCount})` },
            { id: 'address', label: `Has Address (${metrics.addressCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#1d1d1f] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CUSTOMER TABLE ── */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-[#fbfbfd] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Auth Method</th>
                <th className="py-3.5 px-4">Orders & Spend</th>
                <th className="py-3.5 px-4">Delivery Location</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 text-xs">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No customers found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your search query or filter</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const initials = (customer.name || customer.email || 'U').slice(0, 2).toUpperCase()
                  const cleanPhone = customer.phone ? customer.phone.replace(/\D/g, '') : null
                  const waNumber = cleanPhone ? (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone) : null

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {customer.avatarUrl ? (
                            <img
                              src={customer.avatarUrl}
                              alt=""
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 font-mono shadow-2xs">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-[#1d1d1f] hover:text-[#e3231c] transition-colors truncate">
                              {customer.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 truncate">
                              <span>UID: {(customer.firebaseUid || customer.id).slice(0, 8)}</span>
                              {customer.companyName && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 font-medium truncate">{customer.companyName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-0.5">
                          {customer.phone ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800 font-mono">
                                +91 {cleanPhone?.slice(-10)}
                              </span>
                              {waNumber && (
                                <a
                                  href={`https://wa.me/${waNumber}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Chat on WhatsApp"
                                  className="w-5 h-5 rounded-md bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] flex items-center justify-center transition-colors"
                                >
                                  <MessageSquare size={11} />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No phone</span>
                          )}
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {customer.email || 'No email attached'}
                          </div>
                        </div>
                      </td>

                      {/* Auth Provider */}
                      <td className="py-3.5 px-4">
                        {customer.authProvider === 'whatsapp' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#128C7E] bg-[#25D366]/10 px-2.5 py-1 rounded-lg border border-[#25D366]/30">
                            <MessageSquare size={11} /> WhatsApp
                          </span>
                        ) : customer.authProvider === 'apple' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            Apple Account
                          </span>
                        ) : customer.authProvider === 'google' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            Google Account
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            Guest Buyer
                          </span>
                        )}
                      </td>

                      {/* Orders & Spend */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-[#1d1d1f]">
                            ₹{customer.totalSpent.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <ShoppingBag size={11} className="text-slate-400" />
                            <span>{customer.ordersCount} {customer.ordersCount === 1 ? 'order' : 'orders'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4">
                        {customer.shippingAddress?.city || customer.shippingAddress?.state ? (
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-800 flex items-center gap-1">
                              <MapPin size={11} className="text-[#e3231c]" />
                              <span>{customer.shippingAddress.city || 'City'}, {customer.shippingAddress.state}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              PIN: {customer.shippingAddress.pincode || 'N/A'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No saved address</span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(customer.registeredAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {waNumber && (
                            <a
                              href={`https://wa.me/${waNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#128C7E] font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1"
                            >
                              <MessageSquare size={11} />
                              <span>Chat</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(customer)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CUSTOMER DETAIL SLIDE-OVER MODAL ── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-black/10 animate-in fade-in zoom-in-95 duration-150 p-6 sm:p-8 space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center text-xl font-bold font-mono shadow-md">
                  {(selectedCustomer.name || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1d1d1f] flex items-center gap-2">
                    {selectedCustomer.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    UID: {selectedCustomer.firebaseUid || selectedCustomer.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#fbfbfd] p-3.5 rounded-2xl border border-black/5 text-center">
                <div className="text-lg font-black text-[#1d1d1f] font-mono">
                  ₹{selectedCustomer.totalSpent.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Lifetime Spend</div>
              </div>
              <div className="bg-[#fbfbfd] p-3.5 rounded-2xl border border-black/5 text-center">
                <div className="text-lg font-black text-[#1d1d1f] font-mono">{selectedCustomer.ordersCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Orders</div>
              </div>
              <div className="bg-[#fbfbfd] p-3.5 rounded-2xl border border-black/5 text-center">
                <div className="text-xs font-bold text-emerald-700 capitalize mt-1">
                  {selectedCustomer.authProvider}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Auth Method</div>
              </div>
            </div>

            {/* Identity & Contact Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#fbfbfd] p-3.5 rounded-xl border border-black/5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Email Address</div>
                  <div className="font-semibold text-slate-800 mt-0.5">{selectedCustomer.email || 'Not provided'}</div>
                </div>
                <div className="bg-[#fbfbfd] p-3.5 rounded-xl border border-black/5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Mobile Phone</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedCustomer.phone ? `+91 ${selectedCustomer.phone.replace(/\D/g, '').slice(-10)}` : 'Not provided'}
                  </div>
                </div>
                <div className="bg-[#fbfbfd] p-3.5 rounded-xl border border-black/5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Company / Organization</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedCustomer.companyName || selectedCustomer.shippingAddress?.companyName || 'Personal Customer'}
                  </div>
                </div>
                <div className="bg-[#fbfbfd] p-3.5 rounded-xl border border-black/5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">GSTIN for B2B Invoice</div>
                  <div className="font-semibold text-slate-800 font-mono mt-0.5">
                    {selectedCustomer.gstin || selectedCustomer.shippingAddress?.gstin || 'None attached'}
                  </div>
                </div>
              </div>
            </div>

            {/* Saved Delivery Address */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saved Delivery Address</h3>
              {selectedCustomer.shippingAddress?.address || selectedCustomer.shippingAddress?.city ? (
                <div className="bg-[#fbfbfd] p-4 rounded-2xl border border-black/5 text-xs space-y-1">
                  <div className="font-bold text-[#1d1d1f] flex items-center justify-between">
                    <span>{selectedCustomer.shippingAddress.fullName || selectedCustomer.name}</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                      {selectedCustomer.shippingAddress.tag || 'Delivery Address'}
                    </span>
                  </div>
                  {selectedCustomer.shippingAddress.houseNo || selectedCustomer.shippingAddress.street ? (
                    <div>
                      <p className="text-slate-800 font-medium">
                        {[selectedCustomer.shippingAddress.houseNo, selectedCustomer.shippingAddress.street].filter(Boolean).join(', ')}
                      </p>
                      {selectedCustomer.shippingAddress.landmark && (
                        <p className="text-slate-500 text-[11px]">Landmark: {selectedCustomer.shippingAddress.landmark}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-600">{selectedCustomer.shippingAddress.address}</p>
                  )}
                  <p className="text-slate-800 font-medium">
                    {selectedCustomer.shippingAddress.city}, {selectedCustomer.shippingAddress.state} - {selectedCustomer.shippingAddress.pincode}
                  </p>
                  <p className="text-slate-500 font-mono pt-1">
                    Phone: {selectedCustomer.shippingAddress.phone || selectedCustomer.phone}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-[#fbfbfd] rounded-2xl border border-black/5 text-xs text-slate-400 italic">
                  No delivery address saved yet by this customer.
                </div>
              )}
            </div>

            {/* Recent Orders List */}
            {selectedCustomer.orders && selectedCustomer.orders.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Order History ({selectedCustomer.orders.length})
                </h3>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto rounded-2xl border border-black/5">
                  {selectedCustomer.orders.map((ord) => (
                    <div key={ord.id} className="p-3 bg-white flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#1d1d1f] font-mono">#{ord.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(ord.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold font-mono text-[#1d1d1f]">₹{ord.total_amount.toLocaleString('en-IN')}</div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              {selectedCustomer.phone && (
                <a
                  href={`https://wa.me/${selectedCustomer.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs"
                >
                  <MessageSquare size={13} />
                  <span>Message on WhatsApp</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
