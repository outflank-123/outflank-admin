'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Phone, 
  Mail, 
  Package, 
  Calendar, 
  ChevronDown, 
  MessageSquare, 
  Plus, 
  Kanban, 
  Table as TableIcon, 
  CheckCircle2, 
  Clock, 
  Building2, 
  UserCheck, 
  TrendingUp, 
  X,
  UserPlus,
  ArrowRight,
  ChevronRight,
  Filter
} from 'lucide-react'

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed'

export interface Lead {
  id: string
  name: string
  company: string
  email: string
  phone?: string | null
  requirements?: string | null
  product_name?: string | null
  status: LeadStatus
  source?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

interface LeadsTableClientProps {
  leads: Lead[]
  activeStatus: string
}

const STAGE_CONFIG: Record<LeadStatus, { label: string; accentBorder: string; badgeBg: string; badgeText: string; dot: string }> = {
  new: {
    label: 'New Inquiries',
    accentBorder: 'border-t-blue-600',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700 border-blue-200',
    dot: 'bg-blue-600',
  },
  contacted: {
    label: 'In Follow-Up',
    accentBorder: 'border-t-amber-500',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  qualified: {
    label: 'Qualified Deals',
    accentBorder: 'border-t-emerald-600',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-600',
  },
  closed: {
    label: 'Closed & Won',
    accentBorder: 'border-t-slate-800',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700 border-purple-200',
    dot: 'bg-purple-600',
  },
}

export default function LeadsTableClient({ leads: initialLeads, activeStatus }: LeadsTableClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>(activeStatus)
  
  // Add Lead Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newLead, setNewLead] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    product_name: 'Custom Corporate Gifting',
    requirements: '',
    status: 'new' as LeadStatus,
  })
  const [isSubmittingNew, setIsSubmittingNew] = useState(false)

  // Edit Notes State
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [noteContent, setNoteContent] = useState('')

  const handleFilterChange = (status: string) => {
    setFilterStatus(status)
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    startTransition(() => {
      router.push(`/leads?${params.toString()}`, { scroll: false })
    })
  }

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    setUpdatingId(leadId)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      })
      if (res.ok) {
        startTransition(() => router.refresh())
      }
    } catch (err) {
      console.error('Failed to update lead status:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const saveLeadNotes = async (leadId: string) => {
    setUpdatingId(leadId)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, notes: noteContent }),
      })
      if (res.ok) {
        setEditingNotesId(null)
        startTransition(() => router.refresh())
      }
    } catch (err) {
      console.error('Failed to save notes:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLead.name || !newLead.company || !newLead.email) return

    setIsSubmittingNew(true)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      })
      if (res.ok) {
        setIsAddModalOpen(false)
        setNewLead({
          name: '',
          company: '',
          email: '',
          phone: '',
          product_name: 'Custom Corporate Gifting',
          requirements: '',
          status: 'new',
        })
        startTransition(() => router.refresh())
      }
    } catch (err) {
      console.error('Failed to create lead:', err)
    } finally {
      setIsSubmittingNew(false)
    }
  }

  const filteredLeads = initialLeads.filter((l) => {
    const matchesStatus = filterStatus === 'all' || l.status === filterStatus
    const matchesSearch = !search.trim() || (
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.company.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone && l.phone.includes(search)) ||
      (l.product_name && l.product_name.toLowerCase().includes(search.toLowerCase()))
    )
    return matchesStatus && matchesSearch
  })

  // Metrics counts
  const totalLeads = initialLeads.length
  const newCount = initialLeads.filter(l => l.status === 'new').length
  const contactedCount = initialLeads.filter(l => l.status === 'contacted').length
  const qualifiedCount = initialLeads.filter(l => l.status === 'qualified').length
  const closedCount = initialLeads.filter(l => l.status === 'closed').length

  const getWhatsAppLink = (phone?: string | null, name?: string, product?: string | null) => {
    if (!phone) return '#'
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`
    const text = encodeURIComponent(`Hi ${name || 'there'}, following up on your inquiry for ${product || 'Outflank Corporate Gifting'}!`)
    return `https://wa.me/${formattedPhone}?text=${text}`
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 font-sans">
      
      {/* ── METRICS SUMMARY BAR ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Total Pipeline</p>
            <p className="text-2xl font-black text-[#1d1d1f] mt-0.5">{totalLeads}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-[#1d1d1f] flex items-center justify-center font-bold">
            <TrendingUp size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-blue-600/70 uppercase tracking-widest">New Inquiries</p>
            <p className="text-2xl font-black text-blue-600 mt-0.5">{newCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Clock size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-amber-600/70 uppercase tracking-widest">In Follow-Up</p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{contactedCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <MessageSquare size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-emerald-600/70 uppercase tracking-widest">Qualified Deals</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{qualifiedCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <p className="text-[10px] font-extrabold text-purple-600/70 uppercase tracking-widest">Closed & Won</p>
            <p className="text-2xl font-black text-purple-700 mt-0.5">{closedCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={18} />
          </div>
        </div>

      </div>

      {/* ── TOOLBAR ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: View Mode Switcher & Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kanban' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-slate-500 hover:text-[#1d1d1f]'
              }`}
            >
              <Kanban size={14} />
              <span>Pipeline Board</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-slate-500 hover:text-[#1d1d1f]'
              }`}
            >
              <TableIcon size={14} />
              <span>Data Table</span>
            </button>
          </div>

          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-slate-400 shadow-2xs cursor-pointer appearance-none"
            >
              <option value="all">All Pipeline Stages</option>
              <option value="new">New Inquiries</option>
              <option value="contacted">In Follow-Up</option>
              <option value="qualified">Qualified Deals</option>
              <option value="closed">Closed & Won</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>
        </div>

        {/* Right: Search & Add Action */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads, companies, phones..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-[#1d1d1f] placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all shadow-2xs"
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#e3231c] hover:bg-[#c81e18] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Deal</span>
          </button>
        </div>

      </div>

      {/* ── KANBAN PIPELINE BOARD VIEW ── */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          
          {(['new', 'contacted', 'qualified', 'closed'] as LeadStatus[]).map((stageKey) => {
            const stage = STAGE_CONFIG[stageKey]
            const stageLeads = filteredLeads.filter(l => l.status === stageKey)

            return (
              <div 
                key={stageKey} 
                className={`bg-slate-50/80 border border-slate-200/70 rounded-2xl ${stage.accentBorder} p-3.5 flex flex-col gap-3 min-h-[520px] shadow-2xs`}
              >
                
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-200/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <h3 className="text-xs font-extrabold text-[#1d1d1f] tracking-tight">
                      {stage.label}
                    </h3>
                  </div>
                  <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${stage.badgeBg} ${stage.badgeText}`}>
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                  {stageLeads.length === 0 ? (
                    <div className="h-32 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-center p-4">
                      <p className="text-[11px] text-slate-400 font-medium">No active deals in stage</p>
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <div 
                        key={lead.id} 
                        className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-slate-300 transition-all space-y-3"
                      >
                        {/* Client Name & Avatar Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-extrabold text-[#1d1d1f] leading-snug">
                              {lead.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                              <Building2 size={12} className="text-slate-400" />
                              <span className="truncate">{lead.company}</span>
                            </p>
                          </div>
                          
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-black flex items-center justify-center shrink-0">
                            {lead.name[0]?.toUpperCase()}
                          </div>
                        </div>

                        {/* Product Tag */}
                        {lead.product_name && (
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/70 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 max-w-full">
                            <Package size={12} className="text-[#e3231c] shrink-0" />
                            <span className="truncate">{lead.product_name}</span>
                          </div>
                        )}

                        {/* Requirements snippet */}
                        {lead.requirements && (
                          <p className="text-[11.5px] text-slate-600 leading-relaxed line-clamp-2 border-l-2 border-[#e3231c]/40 pl-2.5 py-0.5 italic">
                            "{lead.requirements}"
                          </p>
                        )}

                        {/* Action Bar */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          
                          {/* WhatsApp Chat Button */}
                          {lead.phone ? (
                            <a
                              href={getWhatsAppLink(lead.phone, lead.name, lead.product_name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/30 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare size={13} />
                              <span>WhatsApp</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No phone</span>
                          )}

                          {/* Quick Call */}
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200/50 transition-colors"
                              title="Call Lead"
                            >
                              <Phone size={13} />
                            </a>
                          )}

                          {/* Quick Email */}
                          <a
                            href={`mailto:${lead.email}`}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200/50 transition-colors"
                            title="Email Lead"
                          >
                            <Mail size={13} />
                          </a>

                          {/* Stage Advance Button */}
                          {stageKey !== 'closed' && (
                            <button
                              onClick={() => {
                                const nextStage: Record<LeadStatus, LeadStatus> = {
                                  new: 'contacted',
                                  contacted: 'qualified',
                                  qualified: 'closed',
                                  closed: 'closed',
                                }
                                updateLeadStatus(lead.id, nextStage[stageKey])
                              }}
                              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all ml-auto cursor-pointer"
                              title="Advance to Next Stage"
                            >
                              <span>Next</span>
                              <ChevronRight size={12} />
                            </button>
                          )}
                        </div>

                      </div>
                    ))
                  )}
                </div>

              </div>
            )
          })}

        </div>
      ) : (

        /* ── DATA TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="group">
                <div 
                  className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                >
                  
                  {/* Lead Info */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-[#1d1d1f] font-extrabold text-xs flex items-center justify-center shrink-0">
                      {lead.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1d1d1f]">{lead.name}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{lead.company}</p>
                    </div>
                  </div>

                  {/* Product */}
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 min-w-[160px]">
                    <Package size={13} className="text-[#e3231c]" />
                    <span className="truncate font-medium">{lead.product_name || 'General Inquiry'}</span>
                  </div>

                  {/* Phone / WhatsApp */}
                  <div className="hidden md:flex items-center gap-2 min-w-[140px]">
                    {lead.phone ? (
                      <a
                        href={getWhatsAppLink(lead.phone, lead.name, lead.product_name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#128C7E] bg-[#25D366]/10 hover:bg-[#25D366]/20 px-2.5 py-1 rounded-lg transition-colors border border-[#25D366]/30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MessageSquare size={12} />
                        <span>{lead.phone}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No phone</span>
                    )}
                  </div>

                  {/* Stage Dropdown */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                      disabled={updatingId === lead.id}
                      className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-xs font-bold text-slate-700 appearance-none pr-7 shadow-2xs cursor-pointer focus:outline-none"
                    >
                      <option value="new">New Inquiry</option>
                      <option value="contacted">In Follow-Up</option>
                      <option value="qualified">Qualified</option>
                      <option value="closed">Closed / Won</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>

                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-300 text-slate-400 ${expandedId === lead.id ? 'rotate-180' : ''}`}
                  />

                </div>

                {/* Expanded Row Details */}
                {expandedId === lead.id && (
                  <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      
                      {/* Contact Links */}
                      <div className="space-y-2">
                        <p className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Contact Actions</p>
                        <div className="flex flex-col gap-1.5">
                          <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline flex items-center gap-1.5 font-semibold">
                            <Mail size={12} /> {lead.email}
                          </a>
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="text-[#1d1d1f] hover:underline flex items-center gap-1.5 font-semibold">
                              <Phone size={12} /> {lead.phone}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Requirements */}
                      <div className="space-y-1">
                        <p className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Client Requirements</p>
                        <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200/80 italic">
                          {lead.requirements || 'No specific requirements submitted.'}
                        </p>
                      </div>

                      {/* Internal Sales Notes */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Internal Sales Notes</p>
                          {editingNotesId !== lead.id && (
                            <button
                              onClick={() => {
                                setEditingNotesId(lead.id)
                                setNoteContent(lead.notes || '')
                              }}
                              className="text-[10px] font-bold text-[#e3231c] hover:underline"
                            >
                              Edit Notes
                            </button>
                          )}
                        </div>

                        {editingNotesId === lead.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                              placeholder="Type sales notes, follow-up logs..."
                              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-[#1d1d1f] focus:outline-none focus:border-black"
                              rows={3}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveLeadNotes(lead.id)}
                                className="bg-[#1d1d1f] text-white px-3 py-1 rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Save Note
                              </button>
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="text-xs text-slate-400"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80 min-h-[50px]">
                            {lead.notes || 'No internal notes saved yet.'}
                          </p>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      )}

      {/* ── CREATE LEAD MODAL ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-[#e3231c]" />
                <h3 className="text-base font-extrabold text-[#1d1d1f]">Create New Deal / Lead</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-[#1d1d1f]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    value={newLead.company}
                    onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="rahul@acme.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Product Interest</label>
                <input
                  type="text"
                  value={newLead.product_name}
                  onChange={(e) => setNewLead({ ...newLead, product_name: e.target.value })}
                  placeholder="e.g. 250x Custom Ceramic Mugs"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Requirements / Details</label>
                <textarea
                  value={newLead.requirements}
                  onChange={(e) => setNewLead({ ...newLead, requirements: e.target.value })}
                  placeholder="Client requirements, quantity needed, budget..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="bg-[#1d1d1f] hover:bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {isSubmittingNew ? 'Saving Lead...' : 'Create Lead'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  )
}
