'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Search, Phone, Mail, Package, Calendar, MoreHorizontal } from 'lucide-react'

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed'

interface Lead {
  id: string
  name: string
  company: string
  email: string
  phone?: string | null
  requirements?: string | null
  product_name?: string | null
  status: LeadStatus
  source?: string | null
  created_at: string
  updated_at: string
}

const STATUS_OPTIONS: { value: LeadStatus | 'all'; label: string; activeClass: string; idleClass: string }[] = [
  { value: 'all',       label: 'All Leads', activeClass: 'bg-[#1d1d1f] text-white shadow-md', idleClass: 'bg-white/50 text-[#6e6e73] hover:bg-white/80' },
  { value: 'new',       label: 'New',       activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-500/20', idleClass: 'bg-blue-50/50 text-blue-700 hover:bg-blue-50' },
  { value: 'contacted', label: 'Contacted', activeClass: 'bg-amber-500 text-white shadow-md shadow-amber-500/20', idleClass: 'bg-amber-50/50 text-amber-700 hover:bg-amber-50' },
  { value: 'qualified', label: 'Qualified', activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20', idleClass: 'bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50' },
  { value: 'closed',    label: 'Closed',    activeClass: 'bg-slate-500 text-white shadow-md shadow-slate-500/20', idleClass: 'bg-slate-50 text-slate-600 hover:bg-slate-100' },
]

const STATUS_BADGE: Record<LeadStatus, string> = {
  new:       'bg-blue-50 text-blue-700 border-blue-200/50',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200/50',
  qualified: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
  closed:    'bg-slate-50 text-slate-600 border-slate-200',
}

interface LeadsTableClientProps {
  leads: Lead[]
  activeStatus: string
}

export default function LeadsTableClient({ leads, activeStatus }: LeadsTableClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const setStatus = (newStatus: string) => {
    const params = new URLSearchParams()
    if (newStatus !== 'all') params.set('status', newStatus)
    startTransition(() => {
      router.push(`/leads?${params.toString()}`, { scroll: false })
    })
  }

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    setUpdatingId(leadId)
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      })
      if (res.ok) {
        startTransition(() => router.refresh())
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = search.trim()
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.company.toLowerCase().includes(search.toLowerCase()) ||
          l.email.toLowerCase().includes(search.toLowerCase())
      )
    : leads

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* Filters + search (Glass panel) */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] p-2.5 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Status tabs */}
        <div className="flex gap-1.5 p-1 bg-black/[0.02] rounded-[16px] overflow-x-auto w-full sm:w-auto">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`rounded-[12px] px-4 py-2 text-[13px] font-semibold transition-all duration-300 ease-out whitespace-nowrap ${
                activeStatus === opt.value ? opt.activeClass : opt.idleClass
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72 mr-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[12px] border border-transparent bg-white shadow-sm text-[13px] focus:outline-none focus:border-[#e3231c]/30 focus:ring-4 focus:ring-[#e3231c]/5 transition-all placeholder:text-[#86868b]"
          />
        </div>
      </div>

      {/* Table (Glass panel) */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 text-[#86868b]">
              <Search size={24} />
            </div>
            <p className="text-[#1d1d1f] font-semibold">No leads found</p>
            <p className="text-[#86868b] text-[13px] mt-1">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.03]">
            {filtered.map((lead) => (
              <div key={lead.id} className="group">
                {/* Lead row */}
                <div
                  className="px-6 py-4 flex items-center gap-4 hover:bg-white/80 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-white shadow-sm flex items-center justify-center shrink-0 text-[#1d1d1f] font-bold text-sm">
                    {lead.name[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-[14px] font-semibold text-[#1d1d1f] truncate">{lead.name}</p>
                    <p className="text-[12.5px] text-[#86868b] truncate">{lead.company}</p>
                  </div>

                  {/* Product */}
                  {lead.product_name && (
                    <div className="hidden md:flex items-center gap-1.5 text-[12.5px] text-[#86868b] w-[180px] truncate">
                      <Package size={14} className="text-[#1d1d1f]/40" />
                      <span className="truncate">{lead.product_name}</span>
                    </div>
                  )}

                  {/* Date */}
                  <div className="hidden lg:flex items-center gap-1.5 text-[12.5px] text-[#86868b] w-[120px]">
                    <Calendar size={14} className="text-[#1d1d1f]/40" />
                    {new Date(lead.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>

                  {/* Status selector */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                      disabled={updatingId === lead.id}
                      className={`rounded-full border px-3.5 py-1.5 text-[11px] font-bold tracking-wide uppercase appearance-none cursor-pointer pr-7 transition-all ${STATUS_BADGE[lead.status as LeadStatus]} focus:outline-none focus:ring-4 focus:ring-black/5 ${updatingId === lead.id ? 'opacity-50' : 'hover:scale-[1.02]'}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="closed">Closed</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-50" />
                  </div>

                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868b] hover:bg-black/5 transition-colors">
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-300 ${expandedId === lead.id ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === lead.id && (
                  <div className="px-6 pb-6 pt-2 bg-white/40 border-t border-black/[0.03]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ml-[56px]">
                      <div className="space-y-3">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#86868b]">Contact Information</p>
                        <div className="space-y-2">
                          <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-[13.5px] text-[#1d1d1f] hover:text-[#e3231c] transition-colors group/link">
                            <div className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center group-hover/link:bg-[#e3231c]/10">
                              <Mail size={12} className="group-hover/link:text-[#e3231c]" />
                            </div>
                            {lead.email}
                          </a>
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 text-[13.5px] text-[#1d1d1f] hover:text-[#e3231c] transition-colors group/link">
                              <div className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center group-hover/link:bg-[#e3231c]/10">
                                <Phone size={12} className="group-hover/link:text-[#e3231c]" />
                              </div>
                              {lead.phone}
                            </a>
                          )}
                        </div>
                      </div>
                      
                      {lead.product_name && (
                        <div className="space-y-3">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[#86868b]">Product Interest</p>
                          <div className="flex items-start gap-2.5 bg-white p-3 rounded-2xl border border-black/5 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-[#e3231c]/5 text-[#e3231c] flex items-center justify-center shrink-0">
                              <Package size={14} />
                            </div>
                            <p className="text-[13px] font-medium text-[#1d1d1f] leading-snug pt-1.5">{lead.product_name}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-3 lg:col-span-1 md:col-span-2">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#86868b]">Requirements</p>
                        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm text-[13px] text-[#1d1d1f]/80 leading-relaxed min-h-[60px]">
                          {lead.requirements ? (
                            <p className="whitespace-pre-wrap">{lead.requirements}</p>
                          ) : (
                            <p className="text-[#86868b] italic">No specific requirements provided.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
