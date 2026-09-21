'use client'

import React, { useState, useTransition, useMemo, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getAdminCache, setAdminCache } from '@/lib/adminCache'
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
  Filter,
  GripVertical,
  Save,
  RotateCcw,
  AlertCircle,
  CheckSquare,
  Square,
  Loader2,
  Check,
  Layers,
  Sparkles,
  MoveRight,
  FileText,
  Undo2
} from 'lucide-react'

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed'

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

interface StagedMove {
  leadId: string
  targetStatus: LeadStatus
  originalStatus: LeadStatus
  leadName: string
  company: string
}

const STAGE_CONFIG: Record<LeadStatus, { 
  label: string; 
  accentBorder: string; 
  badgeBg: string; 
  badgeText: string; 
  dot: string; 
  dropBorder: string;
  dropBg: string;
}> = {
  new: {
    label: 'New Inquiries',
    accentBorder: 'border-t-blue-600',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700 border-blue-200',
    dot: 'bg-blue-600',
    dropBorder: 'border-blue-500 ring-4 ring-blue-500/10',
    dropBg: 'bg-blue-50/50',
  },
  contacted: {
    label: 'In Follow-Up',
    accentBorder: 'border-t-amber-500',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    dropBorder: 'border-amber-500 ring-4 ring-amber-500/10',
    dropBg: 'bg-amber-50/50',
  },
  qualified: {
    label: 'Qualified Deals',
    accentBorder: 'border-t-emerald-600',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-600',
    dropBorder: 'border-emerald-500 ring-4 ring-emerald-500/10',
    dropBg: 'bg-emerald-50/50',
  },
  closed: {
    label: 'Closed & Won',
    accentBorder: 'border-t-purple-600',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700 border-purple-200',
    dot: 'bg-purple-600',
    dropBorder: 'border-purple-500 ring-4 ring-purple-500/10',
    dropBg: 'bg-purple-50/50',
  },
}

export default function LeadsTableClient({ leads: initialLeads, activeStatus }: LeadsTableClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  
  // Local board state allowing instantaneous visual drag-and-drop and cache hydration
  const [leads, setLeads] = useState<Lead[]>(() => {
    if (initialLeads && initialLeads.length > 0) return initialLeads
    const cached = getAdminCache<Lead[]>('outflank_admin_leads', 10 * 60 * 1000, 'session')
    return cached?.data || initialLeads
  })

  useEffect(() => {
    if (initialLeads && initialLeads.length > 0) {
      setLeads(initialLeads)
      setAdminCache('outflank_admin_leads', initialLeads, 'session')
    }
  }, [initialLeads])
  
  // Staged uncommitted changes map: key is leadId
  const [stagedChanges, setStagedChanges] = useState<Map<string, StagedMove>>(new Map())
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

  // Drag & Drop Canvas State
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null)

  // Multi-Selection State
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())

  // Details & Modals State
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [kanbanExpandedId, setKanbanExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>(activeStatus)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  
  // Add Lead Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newLeadStage, setNewLeadStage] = useState<LeadStatus>('new')
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

  // Sync with initialLeads when server revalidates and NO unsaved changes exist
  useEffect(() => {
    if (stagedChanges.size === 0) {
      setLeads(initialLeads)
    }
  }, [initialLeads, stagedChanges.size])

  // Prevent accidental tab close or navigation when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stagedChanges.size > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [stagedChanges.size])

  // Stage movement logic (instant visual move + staging registration, NO immediate API call)
  const handleStageMove = (leadId: string, targetStatus: LeadStatus) => {
    const idsToMove = selectedLeadIds.has(leadId) && selectedLeadIds.size > 1
      ? Array.from(selectedLeadIds)
      : [leadId]

    setLeads((prev) =>
      prev.map((l) => {
        if (idsToMove.includes(l.id)) {
          return { ...l, status: targetStatus, updated_at: new Date().toISOString() }
        }
        return l
      })
    )

    setStagedChanges((prev) => {
      const next = new Map(prev)
      for (const id of idsToMove) {
        const originalLead = initialLeads.find((l) => l.id === id)
        const originalStatus = originalLead ? originalLead.status : 'new'

        if (targetStatus === originalStatus) {
          next.delete(id)
        } else {
          const currentLead = leads.find((l) => l.id === id) || originalLead
          next.set(id, {
            leadId: id,
            targetStatus,
            originalStatus,
            leadName: currentLead?.name || 'Lead',
            company: currentLead?.company || 'Company',
          })
        }
      }
      return next
    })
  }

  // Revert a single lead's staged movement back to its original state
  const handleRevertSingleLead = (leadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const staged = stagedChanges.get(leadId)
    if (!staged) return

    setLeads((prev) =>
      prev.map((l) => {
        if (l.id === leadId) {
          return { ...l, status: staged.originalStatus }
        }
        return l
      })
    )

    setStagedChanges((prev) => {
      const next = new Map(prev)
      next.delete(leadId)
      return next
    })
  }

  // Discard all staged changes and reset the entire canvas board
  const handleDiscardChanges = () => {
    setLeads(initialLeads)
    setStagedChanges(new Map())
    setSelectedLeadIds(new Set())
    setSaveSuccessMessage(null)
  }

  // Save all staged changes safely to Supabase
  const handleSaveAllChanges = async () => {
    if (stagedChanges.size === 0) return
    setIsSavingBatch(true)
    setSaveSuccessMessage(null)

    try {
      const updates = Array.from(stagedChanges.values()).map((sc) => ({
        id: sc.leadId,
        status: sc.targetStatus,
      }))

      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        const savedCount = stagedChanges.size
        setStagedChanges(new Map())
        setSelectedLeadIds(new Set())
        setSaveSuccessMessage(`Successfully saved ${savedCount} deal stage change(s) to Supabase.`)
        setTimeout(() => setSaveSuccessMessage(null), 4500)
        startTransition(() => router.refresh())
      } else {
        alert(data.error || 'Failed to save stage changes.')
      }
    } catch (err: any) {
      alert(err.message || 'Network exception while saving stage changes.')
    } finally {
      setIsSavingBatch(false)
    }
  }

  // Toggle selection for a single lead
  const toggleSelectLead = (leadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedLeadIds((prev) => {
      const next = new Set(prev)
      if (next.has(leadId)) next.delete(leadId)
      else next.add(leadId)
      return next
    })
  }

  // Toggle select all in a column
  const toggleSelectColumn = (stageKey: LeadStatus, columnLeadIds: string[]) => {
    const allSelected = columnLeadIds.every((id) => selectedLeadIds.has(id))
    setSelectedLeadIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        columnLeadIds.forEach((id) => next.delete(id))
      } else {
        columnLeadIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  // Drag and drop event handlers
  const handleDragStart = (leadId: string, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', leadId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingLeadId(leadId)
  }

  const handleDragEnd = () => {
    setDraggingLeadId(null)
    setDragOverStage(null)
  }

  const handleDragOverColumn = (stageKey: LeadStatus, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverStage !== stageKey) {
      setDragOverStage(stageKey)
    }
  }

  const handleDragLeaveColumn = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverStage(null)
    }
  }

  const handleDropOnColumn = (targetStage: LeadStatus, e: React.DragEvent) => {
    e.preventDefault()
    setDragOverStage(null)
    const leadId = e.dataTransfer.getData('text/plain') || draggingLeadId
    if (leadId) {
      handleStageMove(leadId, targetStage)
    }
    setDraggingLeadId(null)
  }

  const handleFilterChange = (status: string) => {
    setFilterStatus(status)
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    const query = params.toString()
    startTransition(() => {
      router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
    })
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
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, notes: noteContent } : l))
        )
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
        body: JSON.stringify({ ...newLead, status: newLeadStage }),
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

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
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
  }, [leads, filterStatus, search])

  // Live Metrics counts reflecting current canvas state
  const totalLeads = leads.length
  const newCount = leads.filter(l => l.status === 'new').length
  const contactedCount = leads.filter(l => l.status === 'contacted').length
  const qualifiedCount = leads.filter(l => l.status === 'qualified').length
  const closedCount = leads.filter(l => l.status === 'closed').length

  const getWhatsAppLink = (phone?: string | null, name?: string, product?: string | null) => {
    if (!phone) return '#'
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`
    const text = encodeURIComponent(`Hi ${name || 'there'}, following up on your inquiry for ${product || 'Outflank Corporate Gifting'}!`)
    return `https://wa.me/${formattedPhone}?text=${text}`
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 font-sans relative pb-28">
      
      {/* ── SUCCESS NOTIFICATION TOAST ── */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold p-1 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl font-black text-blue-600">{newCount}</span>
              {stagedChanges.size > 0 && (
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  (live)
                </span>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Clock size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-amber-600/70 uppercase tracking-widest">In Follow-Up</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl font-black text-amber-600">{contactedCount}</span>
              {stagedChanges.size > 0 && (
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  (live)
                </span>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <MessageSquare size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-emerald-600/70 uppercase tracking-widest">Qualified Deals</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl font-black text-emerald-600">{qualifiedCount}</span>
              {stagedChanges.size > 0 && (
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  (live)
                </span>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <p className="text-[10px] font-extrabold text-purple-600/70 uppercase tracking-widest">Closed &amp; Won</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl font-black text-purple-700">{closedCount}</span>
              {stagedChanges.size > 0 && (
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  (live)
                </span>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={18} />
          </div>
        </div>

      </div>

      {/* ── TOOLBAR ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: View Mode Switcher & Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-slate-500 hover:text-[#1d1d1f]'
              }`}
            >
              <Kanban size={14} />
              <span>Canvas Board</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
              <option value="closed">Closed &amp; Won</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 hidden xl:flex">
            <Sparkles size={13} className="text-amber-500" />
            <span>Select &amp; drag cards across canvas columns. Changes are staged before saving.</span>
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
            onClick={() => {
              setNewLeadStage('new')
              setIsAddModalOpen(true)
            }}
            className="flex items-center gap-1.5 bg-[#e3231c] hover:bg-[#c81e18] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Deal</span>
          </button>
        </div>

      </div>

      {/* ── BATCH SELECTION ACTIONS DOCK (WHEN MULTIPLE SELECTED) ── */}
      {selectedLeadIds.size > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-3 px-4 shadow-lg flex items-center justify-between gap-4 flex-wrap animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-bold">{selectedLeadIds.size} deal{selectedLeadIds.size > 1 ? 's' : ''} selected</span>
            <span className="text-slate-400 text-xs hidden md:inline">• Drag any selected card or use quick stage move:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const firstId = Array.from(selectedLeadIds)[0]
                if (firstId) handleStageMove(firstId, 'new')
              }}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-colors cursor-pointer"
            >
              Move to New
            </button>
            <button
              onClick={() => {
                const firstId = Array.from(selectedLeadIds)[0]
                if (firstId) handleStageMove(firstId, 'contacted')
              }}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors cursor-pointer"
            >
              Move to Follow-Up
            </button>
            <button
              onClick={() => {
                const firstId = Array.from(selectedLeadIds)[0]
                if (firstId) handleStageMove(firstId, 'qualified')
              }}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors cursor-pointer"
            >
              Move to Qualified
            </button>
            <button
              onClick={() => {
                const firstId = Array.from(selectedLeadIds)[0]
                if (firstId) handleStageMove(firstId, 'closed')
              }}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-colors cursor-pointer"
            >
              Move to Closed
            </button>
            <button
              onClick={() => setSelectedLeadIds(new Set())}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── KANBAN CANVAS PIPELINE BOARD VIEW ── */}
      {viewMode === 'kanban' ? (
        <div className="bg-slate-100/50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] p-4 md:p-5 rounded-3xl border border-slate-200/70 shadow-inner">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            
            {(['new', 'contacted', 'qualified', 'closed'] as LeadStatus[]).map((stageKey) => {
              const stage = STAGE_CONFIG[stageKey]
              const stageLeads = filteredLeads.filter(l => l.status === stageKey)
              const stageLeadIds = stageLeads.map(l => l.id)
              const isColumnHovered = dragOverStage === stageKey
              const isAllInColumnSelected = stageLeadIds.length > 0 && stageLeadIds.every(id => selectedLeadIds.has(id))

              return (
                <div 
                  key={stageKey}
                  onDragOver={(e) => handleDragOverColumn(stageKey, e)}
                  onDragLeave={handleDragLeaveColumn}
                  onDrop={(e) => handleDropOnColumn(stageKey, e)}
                  className={`rounded-2xl border transition-all duration-150 p-3.5 flex flex-col gap-3 min-h-[580px] shadow-2xs backdrop-blur-xs ${
                    stage.accentBorder
                  } ${
                    isColumnHovered
                      ? `${stage.dropBorder} ${stage.dropBg} scale-[1.01] shadow-md`
                      : 'bg-white/90 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                      <h3 className="text-xs font-black text-[#1d1d1f] tracking-tight">
                        {stage.label}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      {stageLeads.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleSelectColumn(stageKey, stageLeadIds)}
                          className="text-[10px] font-semibold text-slate-400 hover:text-slate-800 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                          title={isAllInColumnSelected ? 'Deselect column' : 'Select all in column'}
                        >
                          {isAllInColumnSelected ? 'Deselect' : 'Select All'}
                        </button>
                      )}
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${stage.badgeBg} ${stage.badgeText}`}>
                        {stageLeads.length}
                      </span>
                    </div>
                  </div>

                  {/* Drop Target Indicator when dragging */}
                  {isColumnHovered && (
                    <div className="p-3.5 rounded-xl border-2 border-dashed border-slate-800/40 bg-white/90 text-center animate-pulse shadow-xs">
                      <p className="text-xs font-extrabold text-slate-900 flex items-center justify-center gap-1.5">
                        <MoveRight size={14} />
                        <span>
                          Drop {selectedLeadIds.has(draggingLeadId || '') && selectedLeadIds.size > 1 ? `${selectedLeadIds.size} deals` : 'deal'} here
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        Move to {stage.label} (Staged)
                      </p>
                    </div>
                  )}

                  {/* Cards List */}
                  <div className="flex flex-col gap-3 flex-1 overflow-y-auto min-h-[420px]">
                    {stageLeads.length === 0 && !isColumnHovered ? (
                      <div className="h-44 border border-dashed border-slate-200/90 rounded-2xl flex flex-col items-center justify-center text-center p-4 bg-slate-50/50">
                        <p className="text-[11px] text-slate-400 font-semibold">No deals in this stage</p>
                        <p className="text-[10px] text-slate-400 mt-1">Drag and drop cards here</p>
                        <button
                          onClick={() => {
                            setNewLeadStage(stageKey)
                            setIsAddModalOpen(true)
                          }}
                          className="mt-3 text-[10px] font-bold text-[#e3231c] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={11} />
                          <span>Add deal to {stage.label}</span>
                        </button>
                      </div>
                    ) : (
                      stageLeads.map((lead) => {
                        const isStaged = stagedChanges.has(lead.id)
                        const stagedInfo = stagedChanges.get(lead.id)
                        const isSelected = selectedLeadIds.has(lead.id)
                        const isBeingDragged = draggingLeadId === lead.id
                        const isExpandedInKanban = kanbanExpandedId === lead.id

                        return (
                          <div 
                            key={lead.id}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(lead.id, e)}
                            onDragEnd={handleDragEnd}
                            className={`bg-white rounded-2xl border p-3.5 shadow-2xs hover:shadow-md transition-all space-y-2.5 cursor-grab active:cursor-grabbing relative select-none ${
                              isBeingDragged ? 'opacity-35 scale-95 ring-2 ring-slate-900 shadow-xl' : ''
                            } ${
                              isStaged
                                ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/15'
                                : isSelected
                                ? 'border-slate-900 ring-2 ring-slate-900/20 bg-slate-50/40'
                                : 'border-slate-200/80 hover:border-slate-300'
                            }`}
                          >
                            {/* Staged Unsaved Badge with single-card Revert */}
                            {isStaged && stagedInfo && (
                              <div className="flex items-center justify-between bg-amber-100/70 border border-amber-200/80 text-amber-900 px-2.5 py-1 rounded-xl text-[10px] font-bold">
                                <span className="flex items-center gap-1.5 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                  <span>Moved from {STAGE_CONFIG[stagedInfo.originalStatus].label}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleRevertSingleLead(lead.id, e)}
                                  className="text-[10px] text-amber-800 hover:text-amber-950 underline hover:no-underline font-extrabold ml-1 flex items-center gap-0.5 cursor-pointer shrink-0"
                                  title="Revert back to original stage"
                                >
                                  <Undo2 size={11} />
                                  <span>Undo</span>
                                </button>
                              </div>
                            )}

                            {/* Client Name, Checkbox & Drag Handle */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Drag Handle */}
                                <div 
                                  className="text-slate-300 hover:text-slate-600 shrink-0 cursor-grab p-0.5" 
                                  title="Drag card"
                                >
                                  <GripVertical size={15} />
                                </div>

                                {/* Multi-Selection Checkbox */}
                                <button
                                  type="button"
                                  onClick={(e) => toggleSelectLead(lead.id, e)}
                                  className="text-slate-400 hover:text-slate-900 shrink-0 p-0.5 cursor-pointer"
                                  title={isSelected ? 'Deselect' : 'Select for batch drag'}
                                >
                                  {isSelected ? (
                                    <CheckSquare size={15} className="text-slate-900" />
                                  ) : (
                                    <Square size={15} />
                                  )}
                                </button>

                                <div className="min-w-0 space-y-0.5">
                                  <h4 className="text-xs font-black text-[#1d1d1f] leading-snug truncate">
                                    {lead.name}
                                  </h4>
                                  <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                                    <Building2 size={11} className="text-slate-400 shrink-0" />
                                    <span className="truncate">{lead.company}</span>
                                  </p>
                                </div>
                              </div>
                              
                              {/* Avatar Initial */}
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-[#1d1d1f] border border-slate-200 text-[11px] font-black flex items-center justify-center shrink-0">
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
                              <p className="text-[11.5px] text-slate-600 leading-relaxed line-clamp-2 border-l-2 border-[#e3231c]/40 pl-2 py-0.5 italic bg-slate-50/50 rounded-r-md">
                                &ldquo;{lead.requirements}&rdquo;
                              </p>
                            )}

                            {/* Expandable Details Drawer inside Kanban Card */}
                            {isExpandedInKanban && (
                              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5 text-xs animate-in slide-in-from-top-2 duration-150">
                                <div className="flex flex-col gap-1 text-[11px]">
                                  <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline flex items-center gap-1 font-semibold truncate">
                                    <Mail size={11} /> {lead.email}
                                  </a>
                                  {lead.phone && (
                                    <a href={`tel:${lead.phone}`} className="text-slate-800 hover:underline flex items-center gap-1 font-semibold">
                                      <Phone size={11} /> {lead.phone}
                                    </a>
                                  )}
                                </div>

                                {/* Internal Notes in Kanban */}
                                <div className="space-y-1 pt-1 border-t border-slate-200/60">
                                  <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                    <span>Sales Notes</span>
                                    {editingNotesId !== lead.id && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingNotesId(lead.id)
                                          setNoteContent(lead.notes || '')
                                        }}
                                        className="text-[#e3231c] hover:underline cursor-pointer lowercase"
                                      >
                                        edit
                                      </button>
                                    )}
                                  </div>

                                  {editingNotesId === lead.id ? (
                                    <div className="space-y-1.5">
                                      <textarea
                                        value={noteContent}
                                        onChange={(e) => setNoteContent(e.target.value)}
                                        placeholder="Add follow up notes..."
                                        rows={2}
                                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-[#1d1d1f] focus:outline-none"
                                      />
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => saveLeadNotes(lead.id)}
                                          className="bg-slate-900 text-white px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingNotesId(null)}
                                          className="text-[11px] text-slate-400 cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200/70 min-h-[32px]">
                                      {lead.notes || 'No notes added yet.'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action Bar */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                              
                              {/* WhatsApp Button */}
                              {lead.phone ? (
                                <a
                                  href={getWhatsAppLink(lead.phone, lead.name, lead.product_name)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/30 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageSquare size={12} />
                                  <span>WhatsApp</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No phone</span>
                              )}

                              {/* Quick Phone Call */}
                              {lead.phone && (
                                <a
                                  href={`tel:${lead.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200/50 transition-colors"
                                  title="Call Lead"
                                >
                                  <Phone size={12} />
                                </a>
                              )}

                              {/* Quick Email */}
                              <a
                                href={`mailto:${lead.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200/50 transition-colors"
                                title="Email Lead"
                              >
                                <Mail size={12} />
                              </a>

                              {/* Toggle Card Details */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setKanbanExpandedId(isExpandedInKanban ? null : lead.id)
                                }}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200/50 transition-colors cursor-pointer"
                                title={isExpandedInKanban ? 'Hide details' : 'Show details & notes'}
                              >
                                <FileText size={12} />
                              </button>

                              {/* Stage Advance Button (Staged!) */}
                              {stageKey !== 'closed' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const nextStage: Record<LeadStatus, LeadStatus> = {
                                      new: 'contacted',
                                      contacted: 'qualified',
                                      qualified: 'closed',
                                      closed: 'closed',
                                    }
                                    handleStageMove(lead.id, nextStage[stageKey])
                                  }}
                                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 px-2 py-1 rounded-lg text-[11px] font-bold transition-all ml-auto cursor-pointer"
                                  title="Advance to Next Stage (Staged)"
                                >
                                  <span>Next</span>
                                  <ChevronRight size={12} />
                                </button>
                              )}
                            </div>

                          </div>
                        )
                      })
                    )}
                  </div>

                </div>
              )
            })}

          </div>
        </div>
      ) : (

        /* ── DATA TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredLeads.map((lead) => {
              const isStaged = stagedChanges.has(lead.id)
              const stagedInfo = stagedChanges.get(lead.id)

              return (
                <div key={lead.id} className="group">
                  <div 
                    className={`px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer ${
                      isStaged ? 'bg-amber-50/30' : ''
                    }`}
                    onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                  >
                    
                    {/* Lead Info */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-[#1d1d1f] font-extrabold text-xs flex items-center justify-center shrink-0">
                        {lead.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-[#1d1d1f]">{lead.name}</p>
                          {isStaged && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Staged ({stagedInfo ? STAGE_CONFIG[stagedInfo.targetStatus].label : 'Moved'})
                            </span>
                          )}
                        </div>
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

                    {/* Stage Dropdown (Stages move locally!) */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={(e) => handleStageMove(lead.id, e.target.value as LeadStatus)}
                        className={`rounded-full px-3 py-1 text-xs font-bold appearance-none pr-7 shadow-2xs cursor-pointer focus:outline-none border ${
                          isStaged
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
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
                                className="text-[10px] font-bold text-[#e3231c] hover:underline cursor-pointer"
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
                                  className="text-xs text-slate-400 cursor-pointer"
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
              )
            })}
          </div>
        </div>

      )}

      {/* ── STAGED CHANGES FLOATING ACTION DOCK (BATCH SAVE) ── */}
      {stagedChanges.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[92%] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-slate-700/80 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold shrink-0">
              <AlertCircle size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white flex items-center gap-2">
                <span>{stagedChanges.size} Unsaved Pipeline Movement{stagedChanges.size > 1 ? 's' : ''}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-semibold">
                  Pending Save
                </span>
              </p>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                Deals have been moved on your canvas. Click &quot;Save All Changes&quot; to safely commit to Supabase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={isSavingBatch}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Discard</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllChanges}
              disabled={isSavingBatch}
              className="px-4 py-2.5 rounded-xl text-xs font-black bg-white text-slate-900 hover:bg-slate-100 shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSavingBatch ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving to Supabase...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save All Changes</span>
                </>
              )}
            </button>
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
                <h3 className="text-base font-black text-[#1d1d1f]">Create New Deal / Lead</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-[#1d1d1f] cursor-pointer">
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
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Initial Pipeline Stage</label>
                <select
                  value={newLeadStage}
                  onChange={(e) => setNewLeadStage(e.target.value as LeadStatus)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="new">New Inquiries</option>
                  <option value="contacted">In Follow-Up</option>
                  <option value="qualified">Qualified Deals</option>
                  <option value="closed">Closed &amp; Won</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Product Interest</label>
                <input
                  type="text"
                  value={newLead.product_name}
                  onChange={(e) => setNewLead({ ...newLead, product_name: e.target.value })}
                  placeholder="e.g. 250x Custom Bio-Washed Polos"
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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="bg-[#1d1d1f] hover:bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
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
