'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Tag, Plus, Trash2, Pencil, CheckCircle, XCircle,
  Loader2, ToggleLeft, ToggleRight, Copy, Check,
  Percent, IndianRupee, Calendar, Users, Hash,
  ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react'

interface Coupon {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  min_order_amount: number
  max_discount_amount: number | null
  usage_limit_total: number | null
  usage_limit_per_user: number
  used_count: number
  is_active: boolean
  expires_at: string | null
  first_order_only: boolean
  description: string | null
  created_at: string
}

const emptyForm = {
  code: '',
  type: 'percentage' as 'percentage' | 'fixed',
  value: '',
  min_order_amount: '',
  max_discount_amount: '',
  usage_limit_total: '',
  usage_limit_per_user: '1',
  is_active: true,
  expires_at: '',
  first_order_only: false,
  description: '',
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/coupons')
      const data = await res.json()
      setCoupons(data.coupons || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  const openCreate = () => {
    setEditingCoupon(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (c: Coupon) => {
    setEditingCoupon(c)
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      min_order_amount: c.min_order_amount ? String(c.min_order_amount) : '',
      max_discount_amount: c.max_discount_amount ? String(c.max_discount_amount) : '',
      usage_limit_total: c.usage_limit_total ? String(c.usage_limit_total) : '',
      usage_limit_per_user: String(c.usage_limit_per_user),
      is_active: c.is_active,
      expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '',
      first_order_only: c.first_order_only,
      description: c.description || '',
    })
    setFormError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingCoupon(null)
    setForm(emptyForm)
    setFormError('')
  }

  const handleSave = async () => {
    if (!form.code.trim()) { setFormError('Coupon code is required.'); return }
    if (!form.value || isNaN(Number(form.value)) || Number(form.value) <= 0) {
      setFormError('Discount value must be a positive number.'); return
    }
    if (form.type === 'percentage' && Number(form.value) > 100) {
      setFormError('Percentage discount cannot exceed 100%.'); return
    }
    setSaving(true)
    setFormError('')

    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : 0,
      max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
      usage_limit_total: form.usage_limit_total ? Number(form.usage_limit_total) : null,
      usage_limit_per_user: Number(form.usage_limit_per_user) || 1,
      is_active: form.is_active,
      expires_at: form.expires_at ? new Date(form.expires_at + 'T23:59:59').toISOString() : null,
      first_order_only: form.first_order_only,
      description: form.description || null,
    }

    try {
      const url = editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : '/api/admin/coupons'
      const method = editingCoupon ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Failed to save coupon.'); return }
      closeForm()
      fetchCoupons()
    } catch (e: any) {
      setFormError(e.message || 'Network error.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon "${code}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
      setCoupons(p => p.filter(c => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggle = async (c: Coupon) => {
    setTogglingId(c.id)
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !c.is_active }),
      })
      const data = await res.json()
      if (res.ok) {
        setCoupons(p => p.map(x => x.id === c.id ? { ...x, is_active: data.coupon.is_active } : x))
      }
    } finally {
      setTogglingId(null)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const isExpired = (c: Coupon) => c.expires_at && new Date(c.expires_at) < new Date()
  const isLimitReached = (c: Coupon) => c.usage_limit_total !== null && c.used_count >= c.usage_limit_total

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1d1d1f] tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Tag size={20} className="text-white" />
              </div>
              Coupon Codes
            </h1>
            <p className="text-[#86868b] text-sm mt-1">
              {coupons.length} coupon{coupons.length !== 1 ? 's' : ''} · Create percentage or fixed-amount discounts
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1d1d1f] text-white rounded-2xl font-semibold text-sm hover:bg-black/80 transition-all shadow-sm"
          >
            <Plus size={16} /> New Coupon
          </button>
        </div>

        {/* Stats Row */}
        {coupons.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Coupons', value: coupons.length, icon: Tag, color: 'text-violet-600', bg: 'bg-violet-50' },
              { label: 'Active', value: coupons.filter(c => c.is_active && !isExpired(c) && !isLimitReached(c)).length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Total Uses', value: coupons.reduce((a, c) => a + (c.used_count || 0), 0), icon: Hash, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Expired / Limit', value: coupons.filter(c => isExpired(c) || isLimitReached(c)).length, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-black/5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div>
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-[#86868b]">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Coupon Table */}
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 size={28} className="animate-spin text-[#86868b]" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="bg-white rounded-3xl border border-black/5 p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <Tag size={28} className="text-violet-400" />
            </div>
            <h3 className="font-semibold text-[#1d1d1f] text-lg mb-2">No coupons yet</h3>
            <p className="text-[#86868b] text-sm mb-6">Create your first discount coupon to start rewarding customers.</p>
            <button onClick={openCreate} className="px-6 py-2.5 bg-[#1d1d1f] text-white rounded-full font-semibold text-sm hover:bg-black/80 transition-all">
              Create Coupon
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {coupons.map(c => {
              const expired = isExpired(c)
              const limitHit = isLimitReached(c)
              const effectivelyActive = c.is_active && !expired && !limitHit
              const isExpanded = expandedId === c.id

              return (
                <div key={c.id} className={`bg-white rounded-2xl border transition-all ${effectivelyActive ? 'border-black/5' : 'border-orange-100 bg-orange-50/30'}`}>
                  {/* Main Row */}
                  <div className="flex items-center gap-4 p-4">
                    {/* Code + Type Badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1d1d1f] text-base tracking-widest font-mono">{c.code}</span>
                        <button
                          onClick={() => copyCode(c.code)}
                          className="p-1 rounded-md hover:bg-black/5 transition-colors text-[#86868b]"
                          title="Copy code"
                        >
                          {copiedCode === c.code ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        </button>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.type === 'percentage' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {c.type === 'percentage' ? `${c.value}% OFF` : `₹${c.value} OFF`}
                        </span>
                        {!effectivelyActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600">
                            {expired ? 'Expired' : limitHit ? 'Limit Reached' : 'Inactive'}
                          </span>
                        )}
                        {c.first_order_only && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">1st Order</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {c.min_order_amount > 0 && (
                          <span className="text-xs text-[#86868b]">Min ₹{c.min_order_amount.toLocaleString('en-IN')}</span>
                        )}
                        {c.max_discount_amount && (
                          <span className="text-xs text-[#86868b]">Cap ₹{c.max_discount_amount.toLocaleString('en-IN')}</span>
                        )}
                        {c.expires_at && (
                          <span className={`text-xs flex items-center gap-0.5 ${expired ? 'text-red-500' : 'text-[#86868b]'}`}>
                            <Calendar size={10} /> {new Date(c.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        <span className="text-xs text-[#86868b] flex items-center gap-0.5">
                          <Users size={10} /> {c.used_count}{c.usage_limit_total ? `/${c.usage_limit_total}` : ''} uses
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(c)}
                        disabled={!!togglingId}
                        title={c.is_active ? 'Deactivate' : 'Activate'}
                        className="p-1.5 rounded-xl hover:bg-black/5 transition-colors"
                      >
                        {togglingId === c.id ? (
                          <Loader2 size={18} className="animate-spin text-[#86868b]" />
                        ) : c.is_active ? (
                          <ToggleRight size={24} className="text-emerald-500" />
                        ) : (
                          <ToggleLeft size={24} className="text-[#86868b]" />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-xl hover:bg-black/5 transition-colors text-[#86868b] hover:text-[#1d1d1f]"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.code)}
                        disabled={deletingId === c.id}
                        className="p-1.5 rounded-xl hover:bg-red-50 transition-colors text-[#86868b] hover:text-[#e3231c]"
                        title="Delete"
                      >
                        {deletingId === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        className="p-1.5 rounded-xl hover:bg-black/5 transition-colors text-[#86868b]"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-black/[0.04] pt-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-[#f5f5f7] rounded-xl p-3">
                          <div className="text-[#86868b] mb-0.5">Per-User Limit</div>
                          <div className="font-semibold text-[#1d1d1f]">{c.usage_limit_per_user} use{c.usage_limit_per_user > 1 ? 's' : ''}</div>
                        </div>
                        <div className="bg-[#f5f5f7] rounded-xl p-3">
                          <div className="text-[#86868b] mb-0.5">Total Limit</div>
                          <div className="font-semibold text-[#1d1d1f]">{c.usage_limit_total ?? 'Unlimited'}</div>
                        </div>
                        <div className="bg-[#f5f5f7] rounded-xl p-3">
                          <div className="text-[#86868b] mb-0.5">Used</div>
                          <div className="font-semibold text-[#1d1d1f]">{c.used_count}</div>
                        </div>
                        <div className="bg-[#f5f5f7] rounded-xl p-3">
                          <div className="text-[#86868b] mb-0.5">First Order Only</div>
                          <div className="font-semibold text-[#1d1d1f]">{c.first_order_only ? 'Yes' : 'No'}</div>
                        </div>
                        {c.description && (
                          <div className="bg-[#f5f5f7] rounded-xl p-3 col-span-2 sm:col-span-4">
                            <div className="text-[#86868b] mb-0.5">Notes</div>
                            <div className="font-medium text-[#1d1d1f]">{c.description}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-black/[0.04] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1d1d1f]">
                {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
              </h2>
              <button onClick={closeForm} className="p-1.5 rounded-xl hover:bg-black/5 text-[#86868b]">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Code */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">Coupon Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SAVE20"
                  className="w-full px-4 py-2.5 border border-black/10 rounded-xl text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-violet-400 bg-[#f5f5f7]"
                />
              </div>

              {/* Type + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">Discount Type *</label>
                  <div className="flex rounded-xl border border-black/10 overflow-hidden">
                    {(['percentage', 'fixed'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, type: t }))}
                        className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                          form.type === t ? 'bg-[#1d1d1f] text-white' : 'bg-white text-[#86868b] hover:bg-black/[0.02]'
                        }`}
                      >
                        {t === 'percentage' ? <Percent size={14} /> : <IndianRupee size={14} />}
                        {t === 'percentage' ? '%' : '₹'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">
                    Value * {form.type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                    min="0"
                    max={form.type === 'percentage' ? 100 : undefined}
                    placeholder={form.type === 'percentage' ? '20' : '100'}
                    className="w-full px-4 py-2.5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-violet-400 bg-[#f5f5f7]"
                  />
                </div>
              </div>

              {/* Min order + Max discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">Min Order (₹)</label>
                  <input
                    type="number"
                    value={form.min_order_amount}
                    onChange={e => setForm(p => ({ ...p, min_order_amount: e.target.value }))}
                    placeholder="0 = no minimum"
                    className="w-full px-4 py-2.5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-violet-400 bg-[#f5f5f7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">Max Discount (₹)</label>
                  <input
                    type="number"
                    value={form.max_discount_amount}
                    onChange={e => setForm(p => ({ ...p, max_discount_amount: e.target.value }))}
                    placeholder={form.type === 'percentage' ? 'Cap ₹ amount' : 'Leave blank'}
                    disabled={form.type === 'fixed'}
                    className="w-full px-4 py-2.5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-violet-400 bg-[#f5f5f7] disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Usage limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">Total Usage Limit</label>
                  <input
                    type="number"
                    value={form.usage_limit_total}
                    onChange={e => setForm(p => ({ ...p, usage_limit_total: e.target.value }))}
                    placeholder="Blank = unlimited"
                    className="w-full px-4 py-2.5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-violet-400 bg-[#f5f5f7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">Per-User Limit</label>
                  <input
                    type="number"
                    value={form.usage_limit_per_user}
                    onChange={e => setForm(p => ({ ...p, usage_limit_per_user: e.target.value }))}
                    min="1"
                    placeholder="1"
                    className="w-full px-4 py-2.5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-violet-400 bg-[#f5f5f7]"
                  />
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">
                  Expiry Date <span className="text-[#86868b] normal-case font-normal">(leave blank = never expires)</span>
                </label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-violet-400 bg-[#f5f5f7]"
                />
              </div>

              {/* Toggles */}
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div
                    onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                    className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${form.is_active ? 'bg-emerald-500' : 'bg-[#d1d1d6]'}`}
                  >
                    <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm font-medium text-[#1d1d1f]">Active</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div
                    onClick={() => setForm(p => ({ ...p, first_order_only: !p.first_order_only }))}
                    className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center px-0.5 cursor-pointer ${form.first_order_only ? 'bg-amber-500' : 'bg-[#d1d1d6]'}`}
                  >
                    <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.first_order_only ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm font-medium text-[#1d1d1f]">First Order Only</span>
                </label>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">Admin Notes</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Internal notes (optional)"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-violet-400 bg-[#f5f5f7] resize-none"
                />
              </div>

              {/* Error */}
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-[#e3231c]">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-[48px] rounded-2xl bg-[#1d1d1f] text-white font-bold text-sm hover:bg-black/80 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
