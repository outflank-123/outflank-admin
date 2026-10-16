'use client'

import React, { useState, useTransition, useMemo, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getAdminCache, setAdminCache } from '@/lib/adminCache'
import {
  Search, Phone, Mail, Package, Calendar, ChevronDown, MessageSquare, Plus,
  Kanban, Table as TableIcon, CheckCircle2, Clock, Building2, UserCheck,
  TrendingUp, X, UserPlus, ArrowRight, ChevronRight, Filter, GripVertical,
  Save, RotateCcw, AlertCircle, CheckSquare, Square, Loader2, Check, Layers,
  Sparkles, MoveRight, FileText, Undo2, IndianRupee, Trash2, ReceiptText,
  Globe, Globe2, Users, ShoppingBag, GitBranch, MessageCircle, Handshake,
  PackageCheck, Banknote, ClipboardList, PenLine, ChevronUp, RefreshCw,
} from 'lucide-react'

// ─── TYPES ─────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'conversation'
  | 'sampling'
  | 'finalise'
  | 'advance_received'
  | 'close_deal'
  | 'delivered'

export type LeadSource =
  | 'website'
  | 'facebook'
  | 'direct'
  | 'indiamart'
  | 'reference'
  | 'whatsapp'
  | 'admin_manual'

export interface Lead {
  id: string
  name: string
  company: string
  email: string
  phone?: string | null
  requirements?: string | null
  product_name?: string | null
  status: LeadStatus
  source?: LeadSource | string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface PaymentLog {
  id: string
  lead_id: string
  product_name?: string | null
  quantity?: number | null
  unit_price?: number | null
  total_amount: number
  payment_type: 'advance' | 'partial' | 'final'
  payment_date: string
  notes?: string | null
  created_at: string
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

// ─── STAGE CONFIG ──────────────────────────────────────────────────────────────

const STAGE_ORDER: LeadStatus[] = [
  'conversation',
  'sampling',
  'finalise',
  'advance_received',
  'close_deal',
  'delivered',
]

const NEXT_STAGE: Record<LeadStatus, LeadStatus> = {
  conversation: 'sampling',
  sampling: 'finalise',
  finalise: 'advance_received',
  advance_received: 'close_deal',
  close_deal: 'delivered',
  delivered: 'delivered',
}

const STAGE_CONFIG: Record<LeadStatus, {
  label: string
  accentBorder: string
  badgeBg: string
  badgeText: string
  dot: string
  dropBorder: string
  dropBg: string
  metricColor: string
  metricBg: string
  icon: React.ElementType
}> = {
  conversation: {
    label: 'Conversation',
    accentBorder: 'border-t-blue-500',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    dropBorder: 'border-blue-500 ring-4 ring-blue-500/10',
    dropBg: 'bg-blue-50/50',
    metricColor: 'text-blue-600',
    metricBg: 'bg-blue-50',
    icon: MessageCircle,
  },
  sampling: {
    label: 'Sampling',
    accentBorder: 'border-t-violet-500',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
    dropBorder: 'border-violet-500 ring-4 ring-violet-500/10',
    dropBg: 'bg-violet-50/50',
    metricColor: 'text-violet-600',
    metricBg: 'bg-violet-50',
    icon: Package,
  },
  finalise: {
    label: 'Finalise',
    accentBorder: 'border-t-amber-500',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    dropBorder: 'border-amber-500 ring-4 ring-amber-500/10',
    dropBg: 'bg-amber-50/50',
    metricColor: 'text-amber-600',
    metricBg: 'bg-amber-50',
    icon: ClipboardList,
  },
  advance_received: {
    label: 'Advance Received',
    accentBorder: 'border-t-orange-500',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    dropBorder: 'border-orange-500 ring-4 ring-orange-500/10',
    dropBg: 'bg-orange-50/50',
    metricColor: 'text-orange-600',
    metricBg: 'bg-orange-50',
    icon: Banknote,
  },
  close_deal: {
    label: 'Close Deal',
    accentBorder: 'border-t-emerald-500',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    dropBorder: 'border-emerald-500 ring-4 ring-emerald-500/10',
    dropBg: 'bg-emerald-50/50',
    metricColor: 'text-emerald-600',
    metricBg: 'bg-emerald-50',
    icon: Handshake,
  },
  delivered: {
    label: 'Delivered ✓',
    accentBorder: 'border-t-purple-600',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700 border-purple-200',
    dot: 'bg-purple-600',
    dropBorder: 'border-purple-600 ring-4 ring-purple-600/10',
    dropBg: 'bg-purple-50/50',
    metricColor: 'text-purple-700',
    metricBg: 'bg-purple-50',
    icon: PackageCheck,
  },
}

// ─── SOURCE CONFIG ─────────────────────────────────────────────────────────────

const SOURCE_OPTIONS: { value: LeadSource; label: string; icon: React.ElementType; bg: string; text: string; border: string }[] = [
  { value: 'website',       label: 'Website',     icon: Globe,          bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  { value: 'facebook',      label: 'Facebook',    icon: Globe2,         bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  { value: 'direct',        label: 'Direct',      icon: Users,          bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-300' },
  { value: 'indiamart',     label: 'IndiaMart',   icon: ShoppingBag,    bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  { value: 'reference',     label: 'Reference',   icon: GitBranch,      bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { value: 'whatsapp',      label: 'WhatsApp',    icon: MessageSquare,  bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
  { value: 'admin_manual',  label: 'Manual',      icon: PenLine,        bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200' },
]

const SOURCE_MAP = Object.fromEntries(SOURCE_OPTIONS.map((s) => [s.value, s]))

const getSourceConfig = (source?: string | null) =>
  source && SOURCE_MAP[source]
    ? SOURCE_MAP[source]
    : { label: source || 'Unknown', icon: PenLine, bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' }

// ─── PAYMENT TYPE CONFIG ────────────────────────────────────────────────────────

const PAYMENT_TYPE_CONFIG = {
  advance:  { label: 'Advance',  bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-200' },
  partial:  { label: 'Partial',  bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-200' },
  final:    { label: 'Final',    bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function LeadsTableClient({ leads: initialLeads, activeStatus }: LeadsTableClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')

  // Local board state
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

  // Staged changes
  const [stagedChanges, setStagedChanges] = useState<Map<string, StagedMove>>(new Map())
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

  // Drag & Drop
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null)

  // Multi-Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())

  // Details & Modals
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [kanbanExpandedId, setKanbanExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>(activeStatus)
  const [filterSource, setFilterSource] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Add Lead Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newLeadStage, setNewLeadStage] = useState<LeadStatus>('conversation')
  const [newLead, setNewLead] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    product_name: 'Custom Corporate Gifting',
    requirements: '',
    status: 'conversation' as LeadStatus,
    source: 'admin_manual' as LeadSource,
  })
  const [isSubmittingNew, setIsSubmittingNew] = useState(false)

  // Notes
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [noteContent, setNoteContent] = useState('')

  // Payment Logs
  const [paymentLogsByLeadId, setPaymentLogsByLeadId] = useState<Record<string, PaymentLog[]>>({})
  const [loadingPaymentLogs, setLoadingPaymentLogs] = useState<Set<string>>(new Set())
  const [paymentLogPanel, setPaymentLogPanel] = useState<string | null>(null) // leadId with open payment panel
  const [addPaymentLeadId, setAddPaymentLeadId] = useState<string | null>(null)
  const [newPayment, setNewPayment] = useState({
    product_name: '',
    quantity: '1',
    unit_price: '',
    total_amount: '',
    payment_type: 'advance' as 'advance' | 'partial' | 'final',
    payment_date: new Date().toISOString().slice(0, 16),
    notes: '',
  })
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [deletingPaymentLogId, setDeletingPaymentLogId] = useState<string | null>(null)

  // Sync with initialLeads when server revalidates and NO unsaved changes exist
  useEffect(() => {
    if (stagedChanges.size === 0) setLeads(initialLeads)
  }, [initialLeads, stagedChanges.size])

  // Prevent accidental tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stagedChanges.size > 0) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [stagedChanges.size])

  // ── Fetch payment logs for a lead ──────────────────────────────────────────
  const fetchPaymentLogs = useCallback(async (leadId: string) => {
    if (paymentLogsByLeadId[leadId] !== undefined || loadingPaymentLogs.has(leadId)) return
    setLoadingPaymentLogs((prev) => new Set(prev).add(leadId))
    try {
      const res = await fetch(`/api/admin/leads/payment-logs?lead_id=${leadId}`)
      const data = await res.json()
      if (res.ok) {
        setPaymentLogsByLeadId((prev) => ({ ...prev, [leadId]: data.logs ?? [] }))
      }
    } catch (e) {
      console.error('Failed to fetch payment logs', e)
    } finally {
      setLoadingPaymentLogs((prev) => { const n = new Set(prev); n.delete(leadId); return n })
    }
  }, [paymentLogsByLeadId, loadingPaymentLogs])

  // Auto-calc total amount when qty / unit_price change
  useEffect(() => {
    const qty = parseFloat(newPayment.quantity) || 0
    const price = parseFloat(newPayment.unit_price) || 0
    if (qty > 0 && price > 0) {
      setNewPayment((p) => ({ ...p, total_amount: (qty * price).toFixed(2) }))
    }
  }, [newPayment.quantity, newPayment.unit_price])

  // ── Stage movement ──────────────────────────────────────────────────────────
  const handleStageMove = (leadId: string, targetStatus: LeadStatus) => {
    const idsToMove = selectedLeadIds.has(leadId) && selectedLeadIds.size > 1
      ? Array.from(selectedLeadIds)
      : [leadId]

    setLeads((prev) =>
      prev.map((l) => idsToMove.includes(l.id)
        ? { ...l, status: targetStatus, updated_at: new Date().toISOString() }
        : l
      )
    )

    setStagedChanges((prev) => {
      const next = new Map(prev)
      for (const id of idsToMove) {
        const originalLead = initialLeads.find((l) => l.id === id)
        const originalStatus = originalLead ? originalLead.status : 'conversation'
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

  const handleRevertSingleLead = (leadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const staged = stagedChanges.get(leadId)
    if (!staged) return
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: staged.originalStatus } : l))
    setStagedChanges((prev) => { const n = new Map(prev); n.delete(leadId); return n })
  }

  const handleDiscardChanges = () => {
    setLeads(initialLeads)
    setStagedChanges(new Map())
    setSelectedLeadIds(new Set())
    setSaveSuccessMessage(null)
  }

  const handleSaveAllChanges = async () => {
    if (stagedChanges.size === 0) return
    setIsSavingBatch(true)
    setSaveSuccessMessage(null)
    try {
      const updates = Array.from(stagedChanges.values()).map((sc) => ({ id: sc.leadId, status: sc.targetStatus }))
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
        setSaveSuccessMessage(`Successfully saved ${savedCount} pipeline stage change(s).`)
        setTimeout(() => setSaveSuccessMessage(null), 4500)
        startTransition(() => router.refresh())
      } else {
        alert(data.error || 'Failed to save stage changes.')
      }
    } catch (err: any) {
      alert(err.message || 'Network error while saving.')
    } finally {
      setIsSavingBatch(false)
    }
  }

  // ── Multi-select ────────────────────────────────────────────────────────────
  const toggleSelectLead = (leadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedLeadIds((prev) => {
      const next = new Set(prev)
      next.has(leadId) ? next.delete(leadId) : next.add(leadId)
      return next
    })
  }

  const toggleSelectColumn = (stageKey: LeadStatus, colIds: string[]) => {
    const allSel = colIds.every((id) => selectedLeadIds.has(id))
    setSelectedLeadIds((prev) => {
      const next = new Set(prev)
      allSel ? colIds.forEach((id) => next.delete(id)) : colIds.forEach((id) => next.add(id))
      return next
    })
  }

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragStart = (leadId: string, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', leadId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingLeadId(leadId)
  }
  const handleDragEnd = () => { setDraggingLeadId(null); setDragOverStage(null) }
  const handleDragOverColumn = (stageKey: LeadStatus, e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    if (dragOverStage !== stageKey) setDragOverStage(stageKey)
  }
  const handleDragLeaveColumn = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null)
  }
  const handleDropOnColumn = (targetStage: LeadStatus, e: React.DragEvent) => {
    e.preventDefault(); setDragOverStage(null)
    const leadId = e.dataTransfer.getData('text/plain') || draggingLeadId
    if (leadId) handleStageMove(leadId, targetStage)
    setDraggingLeadId(null)
  }

  // ── Filters ─────────────────────────────────────────────────────────────────
  const handleFilterChange = (status: string) => {
    setFilterStatus(status)
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    const query = params.toString()
    startTransition(() => { router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false }) })
  }

  // ── Notes ───────────────────────────────────────────────────────────────────
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
        setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, notes: noteContent } : l))
        startTransition(() => router.refresh())
      }
    } catch (err) { console.error(err) } finally { setUpdatingId(null) }
  }

  // ── Create Lead ─────────────────────────────────────────────────────────────
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
        setNewLead({ name: '', company: '', email: '', phone: '', product_name: 'Custom Corporate Gifting', requirements: '', status: 'conversation', source: 'admin_manual' })
        startTransition(() => router.refresh())
      }
    } catch (err) { console.error(err) } finally { setIsSubmittingNew(false) }
  }

  // ── Payment Logs ────────────────────────────────────────────────────────────
  const openPaymentPanel = (leadId: string) => {
    setPaymentLogPanel((prev) => prev === leadId ? null : leadId)
    fetchPaymentLogs(leadId)
    setAddPaymentLeadId(null)
  }

  const openAddPaymentForm = (lead: Lead) => {
    setAddPaymentLeadId(lead.id)
    setNewPayment({
      product_name: lead.product_name || '',
      quantity: '1',
      unit_price: '',
      total_amount: '',
      payment_type: 'advance',
      payment_date: new Date().toISOString().slice(0, 16),
      notes: '',
    })
  }

  const handleAddPayment = async (e: React.FormEvent, leadId: string) => {
    e.preventDefault()
    if (!newPayment.total_amount) return
    setIsSubmittingPayment(true)
    try {
      const res = await fetch('/api/admin/leads/payment-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, ...newPayment }),
      })
      const data = await res.json()
      if (res.ok && data.log) {
        setPaymentLogsByLeadId((prev) => ({
          ...prev,
          [leadId]: [data.log, ...(prev[leadId] || [])],
        }))
        setAddPaymentLeadId(null)
      } else {
        alert(data.error || 'Failed to add payment log')
      }
    } catch (err: any) { alert(err.message) } finally { setIsSubmittingPayment(false) }
  }

  const handleDeletePaymentLog = async (logId: string, leadId: string) => {
    if (!confirm('Delete this payment log?')) return
    setDeletingPaymentLogId(logId)
    try {
      const res = await fetch(`/api/admin/leads/payment-logs?id=${logId}`, { method: 'DELETE' })
      if (res.ok) {
        setPaymentLogsByLeadId((prev) => ({
          ...prev,
          [leadId]: (prev[leadId] || []).filter((l) => l.id !== logId),
        }))
      }
    } catch (err) { console.error(err) } finally { setDeletingPaymentLogId(null) }
  }

  const getTotalPaid = (leadId: string) =>
    (paymentLogsByLeadId[leadId] || []).reduce((sum, l) => sum + Number(l.total_amount), 0)

  // ── Filtered leads ──────────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchStatus = filterStatus === 'all' || l.status === filterStatus
      const matchSource = filterSource === 'all' || l.source === filterSource
      const q = search.trim().toLowerCase()
      const matchSearch = !q || (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.phone && l.phone.includes(q)) ||
        (l.product_name && l.product_name.toLowerCase().includes(q))
      )
      return matchStatus && matchSource && matchSearch
    })
  }, [leads, filterStatus, filterSource, search])

  // ── Metrics ──────────────────────────────────────────────────────────────────
  const countByStage = (stage: LeadStatus) => leads.filter((l) => l.status === stage).length

  // ── WhatsApp link ────────────────────────────────────────────────────────────
  const getWhatsAppLink = (phone?: string | null, name?: string, product?: string | null) => {
    if (!phone) return '#'
    const clean = phone.replace(/[^0-9]/g, '')
    const num = clean.startsWith('91') ? clean : `91${clean}`
    const text = encodeURIComponent(`Hi ${name || 'there'}, following up on your inquiry for ${product || 'Outflank Corporate Gifting'}!`)
    return `https://wa.me/${num}?text=${text}`
  }

  // ── Payment log display component ─────────────────────────────────────────────
  const PaymentLogsPanel = ({ lead }: { lead: Lead }) => {
    const logs = paymentLogsByLeadId[lead.id] || []
    const isLoading = loadingPaymentLogs.has(lead.id)
    const totalPaid = getTotalPaid(lead.id)
    const isAddingForThis = addPaymentLeadId === lead.id

    return (
      <div className="space-y-3 pt-2 border-t border-slate-200/60 mt-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <ReceiptText size={11} className="text-emerald-600" />
            Payment Logs
          </p>
          <div className="flex items-center gap-2">
            {totalPaid > 0 && (
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Received: {fmt(totalPaid)}
              </span>
            )}
            <button
              type="button"
              onClick={() => openAddPaymentForm(lead)}
              className="text-[10px] font-bold text-[#e3231c] hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <Plus size={11} /> Add
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 py-2">
            <Loader2 size={12} className="animate-spin" /> Loading logs...
          </div>
        )}

        {/* Logs list */}
        {!isLoading && logs.length === 0 && !isAddingForThis && (
          <p className="text-[11px] text-slate-400 italic">No payment logs yet.</p>
        )}

        {!isLoading && logs.length > 0 && (
          <div className="space-y-1.5">
            {logs.map((log) => {
              const ptc = PAYMENT_TYPE_CONFIG[log.payment_type as keyof typeof PAYMENT_TYPE_CONFIG] || PAYMENT_TYPE_CONFIG.advance
              const isDeleting = deletingPaymentLogId === log.id
              return (
                <div key={log.id} className="flex items-start justify-between gap-2 bg-white border border-slate-200/80 rounded-xl px-3 py-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${ptc.bg} ${ptc.text} ${ptc.border}`}>
                        {ptc.label}
                      </span>
                      <span className="text-[11px] font-black text-[#1d1d1f]">{fmt(Number(log.total_amount))}</span>
                    </div>
                    {log.product_name && (
                      <p className="text-[10px] text-slate-600 truncate">
                        {log.product_name}
                        {log.quantity && log.unit_price ? ` × ${log.quantity} @ ${fmt(Number(log.unit_price))}` : ''}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">{fmtDateTime(log.payment_date)}</p>
                    {log.notes && <p className="text-[10px] text-slate-500 italic truncate">"{log.notes}"</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePaymentLog(log.id, lead.id)}
                    disabled={isDeleting}
                    className="text-slate-300 hover:text-red-500 transition-colors shrink-0 p-0.5 cursor-pointer"
                  >
                    {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add payment form */}
        {isAddingForThis && (
          <form onSubmit={(e) => handleAddPayment(e, lead.id)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-2 duration-150">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Add Payment Log</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  value={newPayment.product_name}
                  onChange={(e) => setNewPayment((p) => ({ ...p, product_name: e.target.value }))}
                  placeholder="Product name"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>
              <input
                type="number"
                value={newPayment.quantity}
                onChange={(e) => setNewPayment((p) => ({ ...p, quantity: e.target.value }))}
                placeholder="Qty"
                min="1"
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-slate-400"
              />
              <input
                type="number"
                value={newPayment.unit_price}
                onChange={(e) => setNewPayment((p) => ({ ...p, unit_price: e.target.value }))}
                placeholder="Unit price (₹)"
                min="0"
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-slate-400"
              />
              <input
                type="number"
                value={newPayment.total_amount}
                onChange={(e) => setNewPayment((p) => ({ ...p, total_amount: e.target.value }))}
                placeholder="Total (₹) *"
                min="0"
                required
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-slate-400"
              />
              <select
                value={newPayment.payment_type}
                onChange={(e) => setNewPayment((p) => ({ ...p, payment_type: e.target.value as any }))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-slate-400 cursor-pointer"
              >
                <option value="advance">Advance</option>
                <option value="partial">Partial</option>
                <option value="final">Final</option>
              </select>
              <div className="col-span-2">
                <input
                  type="datetime-local"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment((p) => ({ ...p, payment_date: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="col-span-2">
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Notes (optional)"
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-slate-400 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPayment ? <Loader2 size={11} className="animate-spin" /> : <IndianRupee size={11} />}
                Save Log
              </button>
              <button
                type="button"
                onClick={() => setAddPaymentLeadId(null)}
                className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500 font-sans relative pb-28">

      {/* SUCCESS TOAST */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button onClick={() => setSaveSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* METRICS BAR */}
      <div className="grid grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Total */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between col-span-3 lg:col-span-1">
          <div>
            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Total</p>
            <p className="text-xl font-black text-[#1d1d1f] mt-0.5">{leads.length}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <TrendingUp size={16} />
          </div>
        </div>

        {STAGE_ORDER.map((stage) => {
          const cfg = STAGE_CONFIG[stage]
          const Icon = cfg.icon
          const count = countByStage(stage)
          return (
            <div key={stage} className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
              <div>
                <p className={`text-[9px] font-extrabold uppercase tracking-widest ${cfg.metricColor}/70`}>{cfg.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xl font-black ${cfg.metricColor}`}>{count}</span>
                  {stagedChanges.size > 0 && <span className="text-[9px] font-mono font-bold text-slate-400">(live)</span>}
                </div>
              </div>
              <div className={`w-8 h-8 rounded-xl ${cfg.metricBg} ${cfg.metricColor} flex items-center justify-center`}>
                <Icon size={15} />
              </div>
            </div>
          )
        })}
      </div>

      {/* TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 flex-wrap">
        {/* Left */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'kanban' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-slate-500 hover:text-[#1d1d1f]'}`}
            >
              <Kanban size={14} /> Canvas
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-slate-500 hover:text-[#1d1d1f]'}`}
            >
              <TableIcon size={14} /> Table
            </button>
          </div>

          {/* Stage Filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl pl-3 pr-7 py-2 focus:outline-none focus:border-slate-400 shadow-2xs cursor-pointer appearance-none"
            >
              <option value="all">All Stages</option>
              {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          {/* Source Filter */}
          <div className="relative">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl pl-3 pr-7 py-2 focus:outline-none focus:border-slate-400 shadow-2xs cursor-pointer appearance-none"
            >
              <option value="all">All Sources</option>
              {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads, companies..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-[#1d1d1f] placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all shadow-2xs"
            />
          </div>
          <button
            onClick={() => { setNewLeadStage('conversation'); setIsAddModalOpen(true) }}
            className="flex items-center gap-1.5 bg-[#e3231c] hover:bg-[#c81e18] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] shrink-0 cursor-pointer"
          >
            <Plus size={14} /> Add Deal
          </button>
        </div>
      </div>

      {/* BATCH SELECTION DOCK */}
      {selectedLeadIds.size > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-3 px-4 shadow-lg flex items-center justify-between gap-4 flex-wrap animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckSquare size={15} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-bold">{selectedLeadIds.size} deal{selectedLeadIds.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STAGE_ORDER.map((stage) => {
              const cfg = STAGE_CONFIG[stage]
              return (
                <button
                  key={stage}
                  onClick={() => { const firstId = Array.from(selectedLeadIds)[0]; if (firstId) handleStageMove(firstId, stage) }}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer border border-white/10 bg-white/10 hover:bg-white/20 text-white"
                >
                  → {cfg.label}
                </button>
              )
            })}
            <button onClick={() => setSelectedLeadIds(new Set())} className="px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-white cursor-pointer">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* KANBAN BOARD */}
      {viewMode === 'kanban' ? (
        <div className="bg-slate-100/50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] p-4 rounded-3xl border border-slate-200/70 shadow-inner overflow-x-auto">
          <div className="flex gap-4 items-start min-w-[1560px]">
            {STAGE_ORDER.map((stageKey) => {
              const stage = STAGE_CONFIG[stageKey]
              const stageLeads = filteredLeads.filter((l) => l.status === stageKey)
              const stageLeadIds = stageLeads.map((l) => l.id)
              const isColHovered = dragOverStage === stageKey
              const isAllSel = stageLeadIds.length > 0 && stageLeadIds.every((id) => selectedLeadIds.has(id))

              return (
                <div
                  key={stageKey}
                  onDragOver={(e) => handleDragOverColumn(stageKey, e)}
                  onDragLeave={handleDragLeaveColumn}
                  onDrop={(e) => handleDropOnColumn(stageKey, e)}
                  className={`rounded-2xl border transition-all duration-150 p-3 flex flex-col gap-3 min-h-[520px] shadow-2xs backdrop-blur-xs flex-1 min-w-[240px] max-w-[280px] border-t-4 ${stage.accentBorder} ${
                    isColHovered
                      ? `${stage.dropBorder} ${stage.dropBg} scale-[1.01] shadow-md`
                      : 'bg-white/90 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-1.5">
                      {React.createElement(stage.icon, { size: 13, className: `${stage.metricColor}` })}
                      <h3 className="text-xs font-black text-[#1d1d1f] tracking-tight leading-tight">{stage.label}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {stageLeads.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleSelectColumn(stageKey, stageLeadIds)}
                          className="text-[9px] font-semibold text-slate-400 hover:text-slate-800 px-1 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          {isAllSel ? 'Desel' : 'Sel All'}
                        </button>
                      )}
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${stage.badgeBg} ${stage.badgeText}`}>
                        {stageLeads.length}
                      </span>
                    </div>
                  </div>

                  {/* Drop Indicator */}
                  {isColHovered && (
                    <div className="p-3 rounded-xl border-2 border-dashed border-slate-800/40 bg-white/90 text-center animate-pulse shadow-xs">
                      <p className="text-xs font-extrabold text-slate-900 flex items-center justify-center gap-1">
                        <MoveRight size={13} /> Drop here
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">→ {stage.label}</p>
                    </div>
                  )}

                  {/* Cards */}
                  <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto min-h-[380px]">
                    {stageLeads.length === 0 && !isColHovered ? (
                      <div className="h-32 border border-dashed border-slate-200/90 rounded-2xl flex flex-col items-center justify-center text-center p-3 bg-slate-50/50">
                        <p className="text-[10px] text-slate-400 font-semibold">No deals</p>
                        <button
                          onClick={() => { setNewLeadStage(stageKey); setIsAddModalOpen(true) }}
                          className="mt-2 text-[9px] font-bold text-[#e3231c] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus size={10} /> Add here
                        </button>
                      </div>
                    ) : stageLeads.map((lead) => {
                      const isStaged = stagedChanges.has(lead.id)
                      const stagedInfo = stagedChanges.get(lead.id)
                      const isSelected = selectedLeadIds.has(lead.id)
                      const isDragging = draggingLeadId === lead.id
                      const isExpanded = kanbanExpandedId === lead.id
                      const isPaymentOpen = paymentLogPanel === lead.id
                      const srcCfg = getSourceConfig(lead.source)
                      const SrcIcon = srcCfg.icon

                      return (
                        <div
                          key={lead.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(lead.id, e)}
                          onDragEnd={handleDragEnd}
                          className={`bg-white rounded-2xl border p-3 shadow-2xs hover:shadow-md transition-all space-y-2 cursor-grab active:cursor-grabbing relative select-none ${
                            isDragging ? 'opacity-35 scale-95 ring-2 ring-slate-900 shadow-xl' : ''
                          } ${
                            isStaged ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/15'
                              : isSelected ? 'border-slate-900 ring-2 ring-slate-900/20'
                              : 'border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          {/* Staged badge */}
                          {isStaged && stagedInfo && (
                            <div className="flex items-center justify-between bg-amber-100/70 border border-amber-200/80 text-amber-900 px-2 py-0.5 rounded-lg text-[9px] font-bold">
                              <span className="flex items-center gap-1 truncate">
                                <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                from {STAGE_CONFIG[stagedInfo.originalStatus].label}
                              </span>
                              <button type="button" onClick={(e) => handleRevertSingleLead(lead.id, e)} className="text-amber-800 hover:text-amber-950 underline font-extrabold ml-1 flex items-center gap-0.5 cursor-pointer shrink-0">
                                <Undo2 size={9} /> Undo
                              </button>
                            </div>
                          )}

                          {/* Header: name, company, avatar */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button type="button" onClick={(e) => toggleSelectLead(lead.id, e)} className="text-slate-400 hover:text-slate-900 shrink-0 cursor-pointer">
                                {isSelected ? <CheckSquare size={13} className="text-slate-900" /> : <Square size={13} />}
                              </button>
                              <div className="min-w-0 space-y-0.5">
                                <h4 className="text-xs font-black text-[#1d1d1f] leading-snug truncate">{lead.name}</h4>
                                <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-0.5">
                                  <Building2 size={9} className="shrink-0" />
                                  <span className="truncate">{lead.company}</span>
                                </p>
                              </div>
                            </div>
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-[#1d1d1f] border border-slate-200 text-[10px] font-black flex items-center justify-center shrink-0">
                              {lead.name[0]?.toUpperCase()}
                            </div>
                          </div>

                          {/* Source badge */}
                          {lead.source && (
                            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${srcCfg.bg} ${srcCfg.text} ${srcCfg.border}`}>
                              <SrcIcon size={9} />
                              {srcCfg.label}
                            </div>
                          )}

                          {/* Product tag */}
                          {lead.product_name && (
                            <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-slate-700 max-w-full">
                              <Package size={10} className="text-[#e3231c] shrink-0" />
                              <span className="truncate">{lead.product_name}</span>
                            </div>
                          )}

                          {/* Expandable details */}
                          {isExpanded && (
                            <div className="space-y-2 text-xs animate-in slide-in-from-top-2 duration-150">
                              <div className="flex flex-col gap-1 text-[10px]">
                                <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline flex items-center gap-1 font-semibold truncate">
                                  <Mail size={10} /> {lead.email}
                                </a>
                                {lead.phone && (
                                  <a href={`tel:${lead.phone}`} className="text-slate-800 hover:underline flex items-center gap-1 font-semibold">
                                    <Phone size={10} /> {lead.phone}
                                  </a>
                                )}
                              </div>

                              {/* Notes */}
                              <div className="space-y-1 pt-1 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                  <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Notes</p>
                                  {editingNotesId !== lead.id && (
                                    <button type="button" onClick={() => { setEditingNotesId(lead.id); setNoteContent(lead.notes || '') }} className="text-[9px] text-[#e3231c] hover:underline cursor-pointer">edit</button>
                                  )}
                                </div>
                                {editingNotesId === lead.id ? (
                                  <div className="space-y-1">
                                    <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Add notes..." rows={2} className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-[10px] text-[#1d1d1f] focus:outline-none" />
                                    <div className="flex gap-1">
                                      <button type="button" onClick={() => saveLeadNotes(lead.id)} className="bg-slate-900 text-white px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer">Save</button>
                                      <button type="button" onClick={() => setEditingNotesId(null)} className="text-[9px] text-slate-400 cursor-pointer">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-600 italic bg-white p-1.5 rounded-lg border border-slate-200/70 min-h-[28px]">
                                    {lead.notes || 'No notes yet.'}
                                  </p>
                                )}
                              </div>

                              {/* Payment Logs */}
                              <PaymentLogsPanel lead={lead} />
                            </div>
                          )}

                          {/* Action bar */}
                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                            {lead.phone ? (
                              <a
                                href={getWhatsAppLink(lead.phone, lead.name, lead.product_name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/30 text-[10px] font-bold px-1.5 py-0.5 rounded-lg transition-colors"
                              >
                                <MessageSquare size={10} /> WA
                              </a>
                            ) : <span />}

                            <div className="flex items-center gap-1 ml-auto">
                              {lead.phone && (
                                <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200/50 transition-colors">
                                  <Phone size={10} />
                                </a>
                              )}
                              <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200/50 transition-colors">
                                <Mail size={10} />
                              </a>
                              {/* Payment logs button */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openPaymentPanel(lead.id); if (!isExpanded) setKanbanExpandedId(lead.id) }}
                                className={`p-1 rounded-lg border transition-colors ${isPaymentOpen ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/50'}`}
                                title="Payment logs"
                              >
                                <IndianRupee size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setKanbanExpandedId(isExpanded ? null : lead.id); if (!isExpanded) { setPaymentLogPanel(null) } }}
                                className={`p-1 rounded-lg border transition-colors ${isExpanded ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/50'}`}
                                title={isExpanded ? 'Collapse' : 'Expand details'}
                              >
                                <FileText size={10} />
                              </button>
                              {stageKey !== 'delivered' && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleStageMove(lead.id, NEXT_STAGE[stageKey]) }}
                                  className="flex items-center gap-0.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 px-1.5 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                                  title="Advance to next stage"
                                >
                                  Next <ChevronRight size={9} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (

        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredLeads.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-slate-400">No leads match your filters.</p>
              </div>
            ) : filteredLeads.map((lead) => {
              const isStaged = stagedChanges.has(lead.id)
              const stagedInfo = stagedChanges.get(lead.id)
              const isExpanded = expandedId === lead.id
              const srcCfg = getSourceConfig(lead.source)
              const SrcIcon = srcCfg.icon
              const stageCfg = STAGE_CONFIG[lead.status]
              const isPaymentOpen = paymentLogPanel === lead.id

              return (
                <div key={lead.id} className="group">
                  <div
                    className={`px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer ${isStaged ? 'bg-amber-50/30' : ''}`}
                    onClick={() => { setExpandedId(isExpanded ? null : lead.id); if (!isExpanded) fetchPaymentLogs(lead.id) }}
                  >
                    {/* Lead Info */}
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-[#1d1d1f] font-extrabold text-[10px] flex items-center justify-center shrink-0">
                        {lead.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-[#1d1d1f]">{lead.name}</p>
                          {isStaged && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                              → {stagedInfo ? STAGE_CONFIG[stagedInfo.targetStatus].label : 'Moved'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">{lead.company}</p>
                      </div>
                    </div>

                    {/* Source badge */}
                    <div className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold ${srcCfg.bg} ${srcCfg.text} ${srcCfg.border}`}>
                      <SrcIcon size={9} /> {srcCfg.label}
                    </div>

                    {/* Product */}
                    <div className="hidden md:flex items-center gap-1 text-xs text-slate-600 min-w-[140px]">
                      <Package size={12} className="text-[#e3231c]" />
                      <span className="truncate font-medium">{lead.product_name || 'General Inquiry'}</span>
                    </div>

                    {/* Phone */}
                    <div className="hidden lg:block min-w-[120px]">
                      {lead.phone ? (
                        <a
                          href={getWhatsAppLink(lead.phone, lead.name, lead.product_name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#128C7E] bg-[#25D366]/10 hover:bg-[#25D366]/20 px-2 py-0.5 rounded-lg transition-colors border border-[#25D366]/30"
                        >
                          <MessageSquare size={11} /> {lead.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No phone</span>
                      )}
                    </div>

                    {/* Stage Dropdown */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={(e) => handleStageMove(lead.id, e.target.value as LeadStatus)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold appearance-none pr-6 shadow-2xs cursor-pointer focus:outline-none border ${
                          isStaged ? 'bg-amber-100 text-amber-900 border-amber-300' : `${stageCfg.badgeBg} ${stageCfg.badgeText}`
                        }`}
                      >
                        {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-60" />
                    </div>

                    <ChevronDown size={14} className={`transition-transform duration-300 text-slate-400 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Expanded Row */}
                  {isExpanded && (
                    <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 space-y-4 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        {/* Contact */}
                        <div className="space-y-2">
                          <p className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Contact Actions</p>
                          <div className="flex flex-col gap-1.5">
                            <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline flex items-center gap-1.5 font-semibold">
                              <Mail size={11} /> {lead.email}
                            </a>
                            {lead.phone && (
                              <a href={`tel:${lead.phone}`} className="text-[#1d1d1f] hover:underline flex items-center gap-1.5 font-semibold">
                                <Phone size={11} /> {lead.phone}
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 pt-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold ${srcCfg.bg} ${srcCfg.text} ${srcCfg.border}`}>
                              <SrcIcon size={9} /> {srcCfg.label}
                            </span>
                            <span className="text-[9px] text-slate-400">{fmtDate(lead.created_at)}</span>
                          </div>
                        </div>

                        {/* Requirements */}
                        <div className="space-y-1">
                          <p className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Requirements</p>
                          <p className="text-slate-700 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200/80 italic text-[11px]">
                            {lead.requirements || 'No requirements submitted.'}
                          </p>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Sales Notes</p>
                            {editingNotesId !== lead.id && (
                              <button onClick={() => { setEditingNotesId(lead.id); setNoteContent(lead.notes || '') }} className="text-[10px] font-bold text-[#e3231c] hover:underline cursor-pointer">
                                Edit Notes
                              </button>
                            )}
                          </div>
                          {editingNotesId === lead.id ? (
                            <div className="space-y-2">
                              <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Type notes..." rows={3} className="w-full bg-white border border-slate-300 rounded-xl p-2 text-[11px] focus:outline-none focus:border-black" />
                              <div className="flex items-center gap-2">
                                <button onClick={() => saveLeadNotes(lead.id)} className="bg-[#1d1d1f] text-white px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer">Save Note</button>
                                <button onClick={() => setEditingNotesId(null)} className="text-[11px] text-slate-400 cursor-pointer">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 min-h-[42px] text-[11px]">
                              {lead.notes || 'No notes yet.'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Payment Logs - full width */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
                        <PaymentLogsPanel lead={lead} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* STAGED CHANGES FLOATING DOCK */}
      {stagedChanges.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[92%] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-slate-700/80 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white">{stagedChanges.size} Unsaved Pipeline Movement{stagedChanges.size > 1 ? 's' : ''}</p>
              <p className="text-[10px] text-slate-300 truncate mt-0.5">Deals moved on canvas — click "Save All" to commit to Supabase.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={handleDiscardChanges} disabled={isSavingBatch} className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1">
              <RotateCcw size={12} /> Discard
            </button>
            <button type="button" onClick={handleSaveAllChanges} disabled={isSavingBatch} className="px-4 py-2.5 rounded-xl text-xs font-black bg-white text-slate-900 hover:bg-slate-100 shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
              {isSavingBatch ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Save size={13} /> Save All Changes</>}
            </button>
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={17} className="text-[#e3231c]" />
                <h3 className="text-base font-black text-[#1d1d1f]">Create New Deal / Lead</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-[#1d1d1f] cursor-pointer"><X size={17} /></button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Contact Name *</label>
                  <input type="text" required value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} placeholder="Rahul Sharma" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Company *</label>
                  <input type="text" required value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} placeholder="Acme Corp" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Email *</label>
                  <input type="email" required value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} placeholder="rahul@acme.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Phone</label>
                  <input type="text" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} placeholder="+91 9876543210" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Source */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Lead Source</label>
                  <div className="relative">
                    <select
                      value={newLead.source}
                      onChange={(e) => setNewLead({ ...newLead, source: e.target.value as LeadSource })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400 cursor-pointer appearance-none"
                    >
                      {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                </div>
                {/* Stage */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Pipeline Stage</label>
                  <div className="relative">
                    <select
                      value={newLeadStage}
                      onChange={(e) => setNewLeadStage(e.target.value as LeadStatus)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400 cursor-pointer appearance-none"
                    >
                      {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Product Interest</label>
                <input type="text" value={newLead.product_name} onChange={(e) => setNewLead({ ...newLead, product_name: e.target.value })} placeholder="e.g. 250x Custom Bio-Washed Polos" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400" />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Requirements / Details</label>
                <textarea value={newLead.requirements} onChange={(e) => setNewLead({ ...newLead, requirements: e.target.value })} placeholder="Quantity, budget, branding requirements..." rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400" />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmittingNew} className="bg-[#1d1d1f] hover:bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
                  {isSubmittingNew ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
