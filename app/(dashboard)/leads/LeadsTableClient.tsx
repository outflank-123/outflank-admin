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
  PackageCheck, Banknote, ClipboardList, PenLine, ChevronUp, RefreshCw, Copy, ExternalLink,
  Pencil, Coins, Tag, FileSpreadsheet, Upload, Download,
} from 'lucide-react'
import {
  exportLeadsToExcel,
  downloadSampleLeadsTemplate,
  parseExcelLeadsFile,
  type ExcelLeadRow,
} from '@/lib/excelExportImport'

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

export interface OrderItem {
  id: string
  name: string
  quality?: string
  quantity: number
  unit_price: number
  total: number
}

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
  deal_value?: number | null
  order_items?: OrderItem[] | null
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
  const [activeLeadModalId, setActiveLeadModalId] = useState<string | null>(null)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [isDeletingLead, setIsDeletingLead] = useState(false)
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
    item_quality: '',
    item_quantity: '100',
    item_unit_price: '500',
  })
  const [isSubmittingNew, setIsSubmittingNew] = useState(false)

  // Notes
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [noteContent, setNoteContent] = useState('')

  // Order Items & Quotation state
  const [isAddingItemLeadId, setIsAddingItemLeadId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    quality: '',
    quantity: '100',
    unit_price: '500',
  })
  const [editItemForm, setEditItemForm] = useState({
    id: '',
    name: '',
    quality: '',
    quantity: '',
    unit_price: '',
  })
  const [isSavingItems, setIsSavingItems] = useState(false)

  // Multi-item quotation state for "Create New Deal" modal
  const [newLeadItems, setNewLeadItems] = useState<OrderItem[]>([
    {
      id: 'init_item_1',
      name: 'Custom Corporate Gifting',
      quality: '120 GSM cotton canvas, dual-tone handle',
      quantity: 100,
      unit_price: 500,
      total: 50000,
    },
  ])

  const newLeadTotalQuote = newLeadItems.reduce(
    (acc, i) => acc + (parseFloat(String(i.quantity)) || 0) * (parseFloat(String(i.unit_price)) || 0),
    0
  )

  const addEmptyNewLeadItem = () => {
    setNewLeadItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: '',
        quality: '',
        quantity: 100,
        unit_price: 500,
        total: 50000,
      },
    ])
  }

  const updateNewLeadItem = (index: number, field: string, value: any) => {
    setNewLeadItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item
        const updated = { ...item, [field]: value }
        const qty = parseFloat(String(updated.quantity)) || 0
        const price = parseFloat(String(updated.unit_price)) || 0
        updated.total = qty * price
        return updated
      })
    )
  }

  const removeNewLeadItem = (index: number) => {
    setNewLeadItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  // Client Brief Editing State in Detail Modal
  const [editingRequirementsId, setEditingRequirementsId] = useState<string | null>(null)
  const [requirementsContent, setRequirementsContent] = useState('')
  const [isSavingRequirements, setIsSavingRequirements] = useState(false)

  // Edit Lead Contact Info in Detail Modal
  const [isEditingContactInfo, setIsEditingContactInfo] = useState(false)
  const [editContactForm, setEditContactForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    source: 'admin_manual' as LeadSource,
  })
  const [isSavingContactInfo, setIsSavingContactInfo] = useState(false)

  // Helper to parse payment method and clean notes
  const parseLogNotes = (notesStr: string | null | undefined) => {
    if (!notesStr) return { method: null, note: null }
    const match = notesStr.match(/^\[(.*?)\]\s*(.*)$/)
    if (match) {
      return { method: match[1], note: match[2]?.trim() || null }
    }
    return { method: null, note: notesStr.trim() }
  }

  // Payment Logs
  const [paymentLogsByLeadId, setPaymentLogsByLeadId] = useState<Record<string, PaymentLog[]>>({})
  const [loadingPaymentLogs, setLoadingPaymentLogs] = useState<Set<string>>(new Set())
  const [paymentLogPanel, setPaymentLogPanel] = useState<string | null>(null) // leadId with open payment panel
  const [addPaymentLeadId, setAddPaymentLeadId] = useState<string | null>(null)
  const [newPayment, setNewPayment] = useState({
    amount: '',
    payment_type: 'advance' as 'advance' | 'partial' | 'final',
    payment_method: 'UPI',
    payment_date: new Date().toISOString().slice(0, 16),
    notes: '',
  })
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [deletingPaymentLogId, setDeletingPaymentLogId] = useState<string | null>(null)

  // Excel Export & Import State
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [parsedImportRows, setParsedImportRows] = useState<ExcelLeadRow[]>([])
  const [isParsingExcel, setIsParsingExcel] = useState(false)
  const [isSubmittingImport, setIsSubmittingImport] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true)
      await exportLeadsToExcel(filteredLeads, paymentLogsByLeadId)
      setSaveSuccessMessage('Excel report downloaded with premium styling!')
      setTimeout(() => setSaveSuccessMessage(null), 4000)
    } catch (err: any) {
      alert(`Excel export failed: ${err.message || 'Unknown error'}`)
    } finally {
      setIsExportingExcel(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportError(null)
    setIsParsingExcel(true)
    try {
      const rows = await parseExcelLeadsFile(file)
      if (rows.length === 0) {
        setImportError('No valid lead rows found in the uploaded file.')
      } else {
        setParsedImportRows(rows)
      }
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse Excel file.')
      setParsedImportRows([])
    } finally {
      setIsParsingExcel(false)
    }
  }

  const handleConfirmImport = async () => {
    if (parsedImportRows.length === 0) return
    setIsSubmittingImport(true)
    setImportError(null)
    try {
      const res = await fetch('/api/admin/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: parsedImportRows })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      if (Array.isArray(data.leads)) {
        setLeads((prev) => [...data.leads, ...prev])
      }
      setIsImportModalOpen(false)
      setImportFile(null)
      setParsedImportRows([])
      setSaveSuccessMessage(`Successfully imported ${data.importedCount || parsedImportRows.length} leads from Excel!`)
      setTimeout(() => setSaveSuccessMessage(null), 5000)
    } catch (err: any) {
      setImportError(err.message || 'Failed to import leads')
    } finally {
      setIsSubmittingImport(false)
    }
  }

  // Sync with initialLeads when server revalidates and NO unsaved changes exist
  useEffect(() => {
    if (stagedChanges.size === 0) setLeads(initialLeads)
  }, [initialLeads, stagedChanges.size])

  // ESC to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveLeadModalId(null)
        setIsAddModalOpen(false)
        setIsImportModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Prefetch all payment logs once on mount for instant card summary and modal display
  useEffect(() => {
    const fetchAllLogs = async () => {
      try {
        const res = await fetch('/api/admin/leads/payment-logs?lead_id=all')
        const data = await res.json()
        if (res.ok && Array.isArray(data.logs)) {
          const grouped: Record<string, PaymentLog[]> = {}
          for (const log of data.logs) {
            if (!grouped[log.lead_id]) grouped[log.lead_id] = []
            grouped[log.lead_id].push(log)
          }
          setPaymentLogsByLeadId((prev) => ({ ...prev, ...grouped }))
        }
      } catch (err) {
        console.error('Failed to prefetch payment logs', err)
      }
    }
    fetchAllLogs()
  }, [])

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
    if (loadingPaymentLogs.has(leadId)) return
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
  }, [loadingPaymentLogs])

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

  // ── Order Items & Quotation Helpers ──────────────────────────────────────────
  const getLeadItems = useCallback((lead: Lead): OrderItem[] => {
    if (lead.order_items && Array.isArray(lead.order_items) && lead.order_items.length > 0) {
      return lead.order_items
    }
    if (lead.product_name) {
      const val = Number(lead.deal_value || 0)
      return [{
        id: 'item_default',
        name: lead.product_name,
        quality: '',
        quantity: 1,
        unit_price: val,
        total: val,
      }]
    }
    return []
  }, [])

  const getTotalPaid = useCallback((leadId: string) => {
    return (paymentLogsByLeadId[leadId] || []).reduce((sum, l) => sum + Number(l.total_amount || 0), 0)
  }, [paymentLogsByLeadId])

  const getFinancials = useCallback((lead: Lead) => {
    const items = getLeadItems(lead)
    const orderTotal = items.length > 0
      ? items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)
      : Number(lead.deal_value || 0)
    const totalPaid = getTotalPaid(lead.id)
    const balanceDue = Math.max(0, orderTotal - totalPaid)
    const percentPaid = orderTotal > 0 ? Math.min(100, Math.round((totalPaid / orderTotal) * 100)) : (totalPaid > 0 ? 100 : 0)
    return { items, orderTotal, totalPaid, balanceDue, percentPaid }
  }, [getLeadItems, getTotalPaid])

  const handleSaveOrderItems = async (leadId: string, updatedItems: OrderItem[]) => {
    const calculatedTotal = updatedItems.reduce(
      (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)),
      0
    )
    // Update local state optimistically
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              order_items: updatedItems,
              deal_value: calculatedTotal,
              product_name: updatedItems.length > 0 ? updatedItems.map((i) => `${i.quantity}x ${i.name}`).join(', ') : l.product_name,
              updated_at: new Date().toISOString(),
            }
          : l
      )
    )

    setIsSavingItems(true)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leadId,
          order_items: updatedItems,
          deal_value: calculatedTotal,
          product_name: updatedItems.length > 0 ? updatedItems.map((i) => `${i.quantity}x ${i.name}`).join(', ') : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to update quotation items')
      }
    } catch (err: any) {
      console.error('Error saving order items:', err)
    } finally {
      setIsSavingItems(false)
    }
  }

  const handleAddItem = async (leadId: string) => {
    const name = newItemForm.name.trim()
    const qty = parseFloat(newItemForm.quantity) || 1
    const price = parseFloat(newItemForm.unit_price) || 0
    if (!name) {
      alert('Please enter an item name (e.g. 100x Bags)')
      return
    }

    const targetLead = leads.find((l) => l.id === leadId)
    if (!targetLead) return
    const currentItems = getLeadItems(targetLead)

    const newItem: OrderItem = {
      id: `item_${Date.now()}`,
      name,
      quality: newItemForm.quality.trim(),
      quantity: qty,
      unit_price: price,
      total: qty * price,
    }

    const nextItems = [...currentItems, newItem]
    await handleSaveOrderItems(leadId, nextItems)
    setIsAddingItemLeadId(null)
    setNewItemForm({ name: '', quality: '', quantity: '100', unit_price: '500' })
  }

  const handleStartEditItem = (item: OrderItem) => {
    setEditingItemId(item.id)
    setEditItemForm({
      id: item.id,
      name: item.name,
      quality: item.quality || '',
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
    })
  }

  const handleSaveEditedItem = async (leadId: string) => {
    const targetLead = leads.find((l) => l.id === leadId)
    if (!targetLead) return
    const currentItems = getLeadItems(targetLead)

    const qty = parseFloat(editItemForm.quantity) || 1
    const price = parseFloat(editItemForm.unit_price) || 0

    const nextItems = currentItems.map((item) =>
      item.id === editItemForm.id
        ? {
            ...item,
            name: editItemForm.name.trim() || item.name,
            quality: editItemForm.quality.trim(),
            quantity: qty,
            unit_price: price,
            total: qty * price,
          }
        : item
    )

    await handleSaveOrderItems(leadId, nextItems)
    setEditingItemId(null)
  }

  const handleDeleteItem = async (leadId: string, itemId: string) => {
    if (!confirm('Remove this item from the order quote?')) return
    const targetLead = leads.find((l) => l.id === leadId)
    if (!targetLead) return
    const currentItems = getLeadItems(targetLead)
    const nextItems = currentItems.filter((i) => i.id !== itemId)
    await handleSaveOrderItems(leadId, nextItems)
  }

  // ── Create Lead (Multi-item Support) ──────────────────────────────────────────
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLead.name || !newLead.company || !newLead.email) return
    setIsSubmittingNew(true)
    try {
      const validItems: OrderItem[] = newLeadItems
        .filter((i) => i.name.trim().length > 0)
        .map((i) => {
          const qty = parseFloat(String(i.quantity)) || 1
          const price = parseFloat(String(i.unit_price)) || 0
          return {
            id: i.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: i.name.trim(),
            quality: i.quality?.trim() || '',
            quantity: qty,
            unit_price: price,
            total: qty * price,
          }
        })

      const calculatedDealValue = validItems.reduce((acc, i) => acc + i.total, 0)
      const productNameSummary =
        validItems.length > 0
          ? validItems.map((i) => `${i.quantity}x ${i.name}`).join(', ')
          : newLead.product_name || 'Custom Corporate Gifting'

      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLead.name,
          company: newLead.company,
          email: newLead.email,
          phone: newLead.phone,
          product_name: productNameSummary,
          requirements: newLead.requirements,
          status: newLeadStage,
          source: newLead.source,
          deal_value: calculatedDealValue,
          order_items: validItems,
        }),
      })
      const data = await res.json()
      if (res.ok && data.lead) {
        setIsAddModalOpen(false)
        setLeads((prev) => [data.lead, ...prev])
        setNewLead({
          name: '',
          company: '',
          email: '',
          phone: '',
          product_name: '',
          requirements: '',
          status: 'conversation',
          source: 'admin_manual',
          item_quality: '',
          item_quantity: '100',
          item_unit_price: '500',
        })
        setNewLeadItems([
          {
            id: `item_${Date.now()}`,
            name: 'Custom Corporate Gifting',
            quality: '120 GSM cotton canvas, dual-tone handle',
            quantity: 100,
            unit_price: 500,
            total: 50000,
          },
        ])
        startTransition(() => router.refresh())
      } else {
        alert(data.error || 'Failed to create lead')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmittingNew(false)
    }
  }

  // ── Client Brief & Requirements Save Handler ──────────────────────────────────
  const handleSaveRequirements = async (leadId: string) => {
    setIsSavingRequirements(true)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, requirements: requirementsContent }),
      })
      const data = await res.json()
      if (res.ok) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, requirements: requirementsContent } : l)))
        setEditingRequirementsId(null)
      } else {
        alert(data.error || 'Failed to update brief')
      }
    } catch (err: any) {
      alert(err.message || 'Error updating brief')
    } finally {
      setIsSavingRequirements(false)
    }
  }

  // ── Contact Info Edit Handlers ────────────────────────────────────────────────
  const handleStartEditContact = (lead: Lead) => {
    setEditContactForm({
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone || '',
      source: (lead.source as LeadSource) || 'website',
    })
    setIsEditingContactInfo(true)
  }

  const handleSaveContactInfo = async (leadId: string) => {
    if (!editContactForm.name.trim() || !editContactForm.company.trim() || !editContactForm.email.trim()) {
      alert('Contact Name, Company, and Email are required.')
      return
    }
    setIsSavingContactInfo(true)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leadId,
          name: editContactForm.name.trim(),
          company: editContactForm.company.trim(),
          email: editContactForm.email.trim(),
          phone: editContactForm.phone.trim(),
          source: editContactForm.source,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  name: editContactForm.name.trim(),
                  company: editContactForm.company.trim(),
                  email: editContactForm.email.trim(),
                  phone: editContactForm.phone.trim(),
                  source: editContactForm.source,
                }
              : l
          )
        )
        setIsEditingContactInfo(false)
      } else {
        alert(data.error || 'Failed to update contact details')
      }
    } catch (err: any) {
      alert(err.message || 'Error updating contact details')
    } finally {
      setIsSavingContactInfo(false)
    }
  }

  // ── Payment Logs ────────────────────────────────────────────────────────────
  const openPaymentPanel = (leadId: string) => {
    setPaymentLogPanel((prev) => prev === leadId ? null : leadId)
    fetchPaymentLogs(leadId)
    setAddPaymentLeadId(null)
  }

  const openAddPaymentForm = (lead: Lead) => {
    const { balanceDue } = getFinancials(lead)
    setAddPaymentLeadId(lead.id)
    setNewPayment({
      amount: balanceDue > 0 ? String(balanceDue) : '',
      payment_type: balanceDue > 0 ? 'advance' : 'final',
      payment_method: 'UPI',
      payment_date: new Date().toISOString().slice(0, 16),
      notes: '',
    })
  }

  const handleAddPayment = async (e: React.FormEvent, leadId: string) => {
    e.preventDefault()
    const amountNum = parseFloat(newPayment.amount)
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid positive payment amount (₹)')
      return
    }
    setIsSubmittingPayment(true)
    try {
      const res = await fetch('/api/admin/leads/payment-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          amount: amountNum,
          payment_type: newPayment.payment_type,
          payment_method: newPayment.payment_method,
          payment_date: newPayment.payment_date,
          notes: newPayment.notes,
        }),
      })
      const data = await res.json()
      if (res.ok && data.log) {
        setPaymentLogsByLeadId((prev) => ({
          ...prev,
          [leadId]: [data.log, ...(prev[leadId] || [])],
        }))
        setAddPaymentLeadId(null)
        setNewPayment({
          amount: '',
          payment_type: 'advance',
          payment_method: 'UPI',
          payment_date: new Date().toISOString().slice(0, 16),
          notes: '',
        })
      } else {
        alert(data.error || 'Failed to add payment log')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleDeletePaymentLog = async (logId: string, leadId: string) => {
    if (!confirm('Delete this payment transaction?')) return
    setDeletingPaymentLogId(logId)
    try {
      const res = await fetch(`/api/admin/leads/payment-logs?id=${logId}`, { method: 'DELETE' })
      if (res.ok) {
        setPaymentLogsByLeadId((prev) => ({
          ...prev,
          [leadId]: (prev[leadId] || []).filter((l) => l.id !== logId),
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingPaymentLogId(null)
    }
  }

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

  // ── Modal Lead Reference ───────────────────────────────────────────────────
  const currentModalLead = useMemo(() => {
    if (!activeLeadModalId) return null
    return leads.find((l) => l.id === activeLeadModalId) || null
  }, [activeLeadModalId, leads])

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return
    setIsDeletingLead(true)
    try {
      const res = await fetch(`/api/admin/leads?id=${leadId}`, { method: 'DELETE' })
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId))
        setActiveLeadModalId(null)
        startTransition(() => router.refresh())
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete lead')
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting lead')
    } finally {
      setIsDeletingLead(false)
    }
  }

  const handleCopyLeadInfo = (lead: Lead) => {
    const text = `Lead Details:
Name: ${lead.name}
Company: ${lead.company}
Email: ${lead.email}
Phone: ${lead.phone || 'N/A'}
Stage: ${STAGE_CONFIG[lead.status]?.label || lead.status}
Source: ${lead.source || 'N/A'}
Product: ${lead.product_name || 'N/A'}
Requirements: ${lead.requirements || 'N/A'}
Notes: ${lead.notes || 'N/A'}`
    navigator.clipboard.writeText(text)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  // ── Payment log display component ─────────────────────────────────────────────
  const PaymentLogsPanel = ({ lead }: { lead: Lead }) => {
    const logs = paymentLogsByLeadId[lead.id] || []
    const isLoading = loadingPaymentLogs.has(lead.id)
    const { orderTotal, totalPaid, balanceDue, percentPaid } = getFinancials(lead)
    const isAddingForThis = addPaymentLeadId === lead.id

    return (
      <div className="space-y-3 pt-2 border-t border-slate-200/60 mt-2">
        {/* Financial Balance Summary Bar */}
        <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Order</span>
              <span className="font-black text-white">{fmt(orderTotal)}</span>
            </div>
            <div className="border-l border-slate-800 pl-3">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">Collected</span>
              <span className="font-black text-emerald-400">{fmt(totalPaid)}</span>
            </div>
            <div className="border-l border-slate-800 pl-3">
              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">Balance Due</span>
              <span className={`font-black ${balanceDue > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{fmt(balanceDue)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              balanceDue === 0 && orderTotal > 0
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : totalPaid > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {balanceDue === 0 && orderTotal > 0 ? 'Fully Paid ✓' : totalPaid > 0 ? `${percentPaid}% Paid` : 'Unpaid'}
            </span>
            <button
              type="button"
              onClick={() => openAddPaymentForm(lead)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus size={11} /> Log Payment
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 py-2">
            <Loader2 size={12} className="animate-spin" /> Loading transactions...
          </div>
        )}

        {/* Add Payment Form */}
        {isAddingForThis && (
          <form onSubmit={(e) => handleAddPayment(e, lead.id)} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">Record Payment Tranche</p>
              {balanceDue > 0 && (
                <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                  Pending: {fmt(balanceDue)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Amount Received (₹) *</label>
                <input
                  type="number"
                  step="any"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="e.g. 15000"
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#1d1d1f] focus:outline-none focus:border-slate-800"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Payment Stage</label>
                <select
                  value={newPayment.payment_type}
                  onChange={(e) => setNewPayment((p) => ({ ...p, payment_type: e.target.value as any }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="advance">Advance</option>
                  <option value="partial">Partial Tranche</option>
                  <option value="final">Final Clearance</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Payment Mode</label>
                <select
                  value={newPayment.payment_method}
                  onChange={(e) => setNewPayment((p) => ({ ...p, payment_method: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="UPI">UPI / QR</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment((p) => ({ ...p, payment_date: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Reference / Note</label>
                <input
                  type="text"
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Txn ID, reference, or installment note..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPayment ? <Loader2 size={11} className="animate-spin" /> : <IndianRupee size={11} />}
                Save Payment
              </button>
              <button
                type="button"
                onClick={() => setAddPaymentLeadId(null)}
                className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Logs list */}
        {!isLoading && logs.length === 0 && !isAddingForThis && (
          <p className="text-[11px] text-slate-400 italic">No payments logged yet.</p>
        )}

        {!isLoading && logs.length > 0 && (
          <div className="space-y-1.5">
            {logs.map((log) => {
              const ptc = PAYMENT_TYPE_CONFIG[log.payment_type as keyof typeof PAYMENT_TYPE_CONFIG] || PAYMENT_TYPE_CONFIG.advance
              const isDeleting = deletingPaymentLogId === log.id
              return (
                <div key={log.id} className="flex items-center justify-between gap-2 bg-white border border-slate-200/80 rounded-xl px-3 py-2 text-xs">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${ptc.bg} ${ptc.text} ${ptc.border}`}>
                        {ptc.label}
                      </span>
                      <span className="font-black text-[#1d1d1f]">{fmt(Number(log.total_amount))}</span>
                      <span className="text-[10px] text-slate-400">{fmtDateTime(log.payment_date)}</span>
                    </div>
                    {log.notes && <p className="text-[10px] text-slate-600 font-medium truncate">{log.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePaymentLog(log.id, lead.id)}
                    disabled={isDeleting}
                    className="text-slate-300 hover:text-rose-500 transition-colors shrink-0 p-1 cursor-pointer"
                    title="Delete payment"
                  >
                    {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              )
            })}
          </div>
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
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 md:w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads, companies..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-[#1d1d1f] placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all shadow-2xs"
            />
          </div>

          {/* Import Excel */}
          <button
            type="button"
            onClick={() => { setIsImportModalOpen(true); setImportError(null); setImportFile(null); setParsedImportRows([]) }}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-2xs cursor-pointer shrink-0"
            title="Import leads from Excel (.xlsx)"
          >
            <Upload size={13} className="text-slate-600" />
            <span className="hidden sm:inline">Import</span> Excel
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
            title="Download beautifully styled Excel workbook with metrics and pipeline stages"
          >
            {isExportingExcel ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
            <span className="hidden sm:inline">Export</span> Excel
          </button>

          {/* Add Deal */}
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
          <div className="flex gap-4 xl:gap-5 items-start min-w-max pb-4">
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
                  className={`rounded-2xl border transition-all duration-150 p-3.5 flex flex-col gap-3.5 min-h-[560px] shadow-2xs backdrop-blur-xs w-[350px] min-w-[350px] xl:w-[380px] xl:min-w-[380px] shrink-0 border-t-4 ${stage.accentBorder} ${
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
                      const srcCfg = getSourceConfig(lead.source)
                      const SrcIcon = srcCfg.icon
                      const { items, orderTotal, totalPaid, balanceDue, percentPaid } = getFinancials(lead)
                      const paymentCount = (paymentLogsByLeadId[lead.id] || []).length
                      const isExpanded = kanbanExpandedId === lead.id
                      const isAddingItemHere = isAddingItemLeadId === lead.id

                      return (
                        <div
                          key={lead.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(lead.id, e)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            setKanbanExpandedId((prev) => (prev === lead.id ? null : lead.id))
                            fetchPaymentLogs(lead.id)
                          }}
                          className={`group bg-white rounded-2xl border p-3.5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-150 space-y-2.5 cursor-pointer relative select-none ${
                            isDragging ? 'opacity-35 scale-95 ring-2 ring-slate-900 shadow-xl' : ''
                          } ${
                            isStaged ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/15'
                              : isSelected ? 'border-slate-900 ring-2 ring-slate-900/20'
                              : isExpanded ? 'border-slate-800 shadow-md ring-2 ring-slate-900/5'
                              : 'border-slate-200/80'
                          }`}
                        >
                          {/* Staged movement badge */}
                          {isStaged && stagedInfo && (
                            <div className="flex items-center justify-between bg-amber-100/80 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-lg text-[9px] font-bold">
                              <span className="flex items-center gap-1 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                from {STAGE_CONFIG[stagedInfo.originalStatus].label}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleRevertSingleLead(lead.id, e)}
                                className="text-amber-800 hover:text-amber-950 underline font-extrabold ml-1 flex items-center gap-0.5 cursor-pointer shrink-0"
                              >
                                <Undo2 size={9} /> Undo
                              </button>
                            </div>
                          )}

                          {/* Header: Checkbox + Name + Company + Avatar */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => toggleSelectLead(lead.id, e)}
                                className="text-slate-400 hover:text-slate-900 shrink-0 mt-0.5 cursor-pointer"
                              >
                                {isSelected ? <CheckSquare size={13} className="text-slate-900" /> : <Square size={13} />}
                              </button>
                              <div className="min-w-0 space-y-0.5">
                                <h4 className="text-xs font-black text-[#1d1d1f] leading-snug truncate group-hover:text-blue-600 transition-colors">
                                  {lead.name}
                                </h4>
                                <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 truncate">
                                  <Building2 size={9} className="shrink-0 text-slate-400" />
                                  <span className="truncate">{lead.company}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="w-6 h-6 rounded-full bg-slate-100 text-[#1d1d1f] border border-slate-200 text-[10px] font-black flex items-center justify-center">
                                {lead.name[0]?.toUpperCase()}
                              </div>
                              <span className="text-slate-400 hover:text-slate-700 transition-colors">
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </span>
                            </div>
                          </div>

                          {/* Badges: Source + Financial Status */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {lead.source && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold ${srcCfg.bg} ${srcCfg.text} ${srcCfg.border}`}>
                                <SrcIcon size={9} />
                                {srcCfg.label}
                              </span>
                            )}
                            {orderTotal > 0 ? (
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-[9px] font-bold ${
                                balanceDue === 0
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : totalPaid > 0
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                              }`}>
                                {balanceDue === 0 ? (
                                  <>✓ {fmt(orderTotal)} Paid</>
                                ) : totalPaid > 0 ? (
                                  <>{fmt(totalPaid)} / {fmt(orderTotal)} ({percentPaid}%)</>
                                ) : (
                                  <>{fmt(orderTotal)}</>
                                )}
                              </span>
                            ) : totalPaid > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] font-bold">
                                <IndianRupee size={9} />
                                {fmt(totalPaid)} ({paymentCount})
                              </span>
                            ) : null}
                          </div>

                          {/* Product / Quotation Tag */}
                          {items.length > 0 ? (
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/70 px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-700 max-w-full">
                              <Package size={10} className="text-[#e3231c] shrink-0" />
                              <span className="truncate">
                                {items[0].quantity}x {items[0].name}
                                {items[0].unit_price ? ` @ ${fmt(items[0].unit_price)}` : ''}
                                {items.length > 1 ? ` (+${items.length - 1} more)` : ''}
                              </span>
                            </div>
                          ) : lead.product_name ? (
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/70 px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-700 max-w-full">
                              <Package size={10} className="text-[#e3231c] shrink-0" />
                              <span className="truncate">{lead.product_name}</span>
                            </div>
                          ) : null}

                          {/* ── EXPANDED DETAILS ACCORDION ── */}
                          {isExpanded && (
                            <div
                              className="pt-3 border-t border-slate-100 space-y-3 animate-in slide-in-from-top-2 duration-200 cursor-default"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Quick Contact & Action Strip */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {lead.phone && (
                                  <a
                                    href={getWhatsAppLink(lead.phone, lead.name, lead.product_name)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 bg-[#25D366] hover:bg-[#20ba59] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-2xs"
                                  >
                                    <MessageSquare size={11} /> WhatsApp
                                  </a>
                                )}
                                {lead.phone && (
                                  <a
                                    href={`tel:${lead.phone}`}
                                    className="inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                                  >
                                    <Phone size={10} /> Call
                                  </a>
                                )}
                                <a
                                  href={`mailto:${lead.email}`}
                                  className="inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                                >
                                  <Mail size={10} /> Email
                                </a>
                                <button
                                  type="button"
                                  onClick={() => { setActiveLeadModalId(lead.id); fetchPaymentLogs(lead.id) }}
                                  className="inline-flex items-center gap-1 bg-slate-900 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ml-auto cursor-pointer"
                                  title="Open full dialog popup"
                                >
                                  <ExternalLink size={10} /> Pop-up ↗
                                </button>
                              </div>

                              {/* 1. ORDER ITEMS & QUOTATION ACCORDION */}
                              <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/70 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <Package size={11} className="text-[#e3231c]" />
                                    Order Items ({items.length})
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-800">
                                      Total: {fmt(orderTotal)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsAddingItemLeadId(isAddingItemHere ? null : lead.id)
                                        setNewItemForm({ name: '', quality: '', quantity: '100', unit_price: '500' })
                                      }}
                                      className="text-[10px] font-bold text-[#e3231c] hover:underline cursor-pointer flex items-center gap-0.5"
                                    >
                                      <Plus size={10} /> Add Item
                                    </button>
                                  </div>
                                </div>

                                {/* Add Item Form */}
                                {isAddingItemHere && (
                                  <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2 animate-in slide-in-from-top-1 shadow-xs text-xs">
                                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Add Item to Order</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <input
                                        type="text"
                                        placeholder="Item name (e.g. Bags)"
                                        value={newItemForm.name}
                                        onChange={(e) => setNewItemForm((p) => ({ ...p, name: e.target.value }))}
                                        className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Quality / Specs (e.g. 120 GSM)"
                                        value={newItemForm.quality}
                                        onChange={(e) => setNewItemForm((p) => ({ ...p, quality: e.target.value }))}
                                        className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                                      />
                                      <div>
                                        <label className="text-[9px] text-slate-400 block">Quantity</label>
                                        <input
                                          type="number"
                                          placeholder="100"
                                          min="1"
                                          value={newItemForm.quantity}
                                          onChange={(e) => setNewItemForm((p) => ({ ...p, quantity: e.target.value }))}
                                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] text-slate-400 block">Unit Price (₹)</label>
                                        <input
                                          type="number"
                                          placeholder="500"
                                          min="0"
                                          value={newItemForm.unit_price}
                                          onChange={(e) => setNewItemForm((p) => ({ ...p, unit_price: e.target.value }))}
                                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                      <span className="text-[10px] font-bold text-slate-600">
                                        Line Total: {fmt((parseFloat(newItemForm.quantity) || 0) * (parseFloat(newItemForm.unit_price) || 0))}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setIsAddingItemLeadId(null)}
                                          className="text-[10px] text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isSavingItems}
                                          onClick={() => handleAddItem(lead.id)}
                                          className="bg-slate-900 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1"
                                        >
                                          {isSavingItems ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                          Add Item
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Items List */}
                                {items.length > 0 ? (
                                  <div className="space-y-1">
                                    {items.map((item) => (
                                      <div
                                        key={item.id}
                                        className="bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[10px]"
                                      >
                                        <div className="min-w-0 pr-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-[#1d1d1f] truncate">{item.name}</span>
                                            {item.quality && (
                                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[9px] font-medium truncate max-w-[120px]">
                                                {item.quality}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-slate-500 text-[9px]">
                                            {item.quantity} pcs × {fmt(Number(item.unit_price))} = <span className="font-bold text-slate-800">{fmt(Number(item.total))}</span>
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteItem(lead.id, item.id)}
                                          className="text-slate-300 hover:text-rose-500 p-0.5 cursor-pointer ml-1 shrink-0"
                                          title="Remove item"
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic">No quote items added yet.</p>
                                )}
                              </div>

                              {/* 2. FINANCIAL BALANCE WIDGET */}
                              <div className="bg-slate-900 text-white rounded-xl p-2.5 space-y-2">
                                <div className="grid grid-cols-3 gap-1.5 text-center">
                                  <div className="bg-slate-800/80 rounded-lg p-1.5">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase block">Order</span>
                                    <span className="text-xs font-black text-white">{fmt(orderTotal)}</span>
                                  </div>
                                  <div className="bg-emerald-950/40 rounded-lg p-1.5 border border-emerald-500/20">
                                    <span className="text-[8px] font-bold text-emerald-400 uppercase block">Paid</span>
                                    <span className="text-xs font-black text-emerald-400">{fmt(totalPaid)}</span>
                                  </div>
                                  <div className={`rounded-lg p-1.5 ${balanceDue > 0 ? 'bg-amber-950/40 border border-amber-500/20' : 'bg-slate-800/80'}`}>
                                    <span className={`text-[8px] font-bold uppercase block ${balanceDue > 0 ? 'text-amber-400' : 'text-slate-400'}`}>Balance</span>
                                    <span className={`text-xs font-black ${balanceDue > 0 ? 'text-amber-300' : 'text-slate-400'}`}>{fmt(balanceDue)}</span>
                                  </div>
                                </div>
                                {orderTotal > 0 && (
                                  <div className="space-y-1">
                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${balanceDue === 0 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                        style={{ width: `${percentPaid}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between text-[8px] text-slate-400">
                                      <span>{percentPaid}% cleared</span>
                                      <span>{balanceDue === 0 ? 'Full payment received' : `${fmt(balanceDue)} remaining`}</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 3. PAYMENT LOGS SECTION */}
                              <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/70 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <ReceiptText size={11} className="text-emerald-600" />
                                    Payments {totalPaid > 0 ? `(${fmt(totalPaid)})` : ''}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openAddPaymentForm(lead)}
                                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer flex items-center gap-0.5"
                                  >
                                    <Plus size={10} /> Log Payment
                                  </button>
                                </div>

                                {/* Add payment form inside card */}
                                {addPaymentLeadId === lead.id && (
                                  <form
                                    onSubmit={(e) => handleAddPayment(e, lead.id)}
                                    className="bg-white border border-emerald-400/50 rounded-xl p-2.5 space-y-2 animate-in slide-in-from-top-1 shadow-xs"
                                  >
                                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Record Payment Tranche</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <select
                                        value={newPayment.payment_type}
                                        onChange={(e) => setNewPayment((p) => ({ ...p, payment_type: e.target.value as any }))}
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold capitalize"
                                      >
                                        <option value="advance">Advance</option>
                                        <option value="partial">Partial</option>
                                        <option value="final">Final</option>
                                      </select>
                                      <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="Amount (₹) *"
                                        value={newPayment.amount}
                                        onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))}
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold"
                                      />
                                      <select
                                        value={newPayment.payment_method}
                                        onChange={(e) => setNewPayment((p) => ({ ...p, payment_method: e.target.value }))}
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-semibold"
                                      >
                                        <option value="UPI">UPI</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Cheque">Cheque</option>
                                      </select>
                                      <input
                                        type="datetime-local"
                                        value={newPayment.payment_date}
                                        onChange={(e) => setNewPayment((p) => ({ ...p, payment_date: e.target.value }))}
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px]"
                                      />
                                    </div>
                                    <input
                                      type="text"
                                      placeholder="Txn note / reference"
                                      value={newPayment.notes}
                                      onChange={(e) => setNewPayment((p) => ({ ...p, notes: e.target.value }))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px]"
                                    />
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setAddPaymentLeadId(null)}
                                        className="text-[10px] text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={isSubmittingPayment}
                                        className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </form>
                                )}

                                {/* Logs list */}
                                {(paymentLogsByLeadId[lead.id] || []).length > 0 ? (
                                  <div className="space-y-1">
                                    {(paymentLogsByLeadId[lead.id] || []).map((log) => {
                                      const ptc = PAYMENT_TYPE_CONFIG[log.payment_type as keyof typeof PAYMENT_TYPE_CONFIG] || PAYMENT_TYPE_CONFIG.advance
                                      return (
                                        <div
                                          key={log.id}
                                          className="bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[10px]"
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className={`px-1.5 py-0.2 rounded font-black text-[9px] border ${ptc.bg} ${ptc.text} ${ptc.border}`}>
                                              {ptc.label}
                                            </span>
                                            <span className="font-bold text-[#1d1d1f]">{fmt(Number(log.total_amount))}</span>
                                            {log.notes && <span className="text-slate-400 italic truncate max-w-[80px]">"{log.notes}"</span>}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePaymentLog(log.id, lead.id)}
                                            className="text-slate-300 hover:text-rose-500 p-0.5 cursor-pointer ml-1"
                                          >
                                            <Trash2 size={10} />
                                          </button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic">No payments recorded yet.</p>
                                )}
                              </div>

                              {/* 4. Requirements & Sales Notes */}
                              {lead.requirements && (
                                <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/70 space-y-1 text-[11px]">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Requirements</span>
                                  <p className="text-slate-700 leading-relaxed italic text-[11px]">
                                    {lead.requirements}
                                  </p>
                                </div>
                              )}

                              <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/70 space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sales Notes</span>
                                  {editingNotesId !== lead.id && (
                                    <button
                                      type="button"
                                      onClick={() => { setEditingNotesId(lead.id); setNoteContent(lead.notes || '') }}
                                      className="text-[10px] font-bold text-[#e3231c] hover:underline cursor-pointer flex items-center gap-0.5"
                                    >
                                      <PenLine size={10} /> Edit
                                    </button>
                                  )}
                                </div>

                                {editingNotesId === lead.id ? (
                                  <div className="space-y-1.5 pt-1">
                                    <textarea
                                      value={noteContent}
                                      onChange={(e) => setNoteContent(e.target.value)}
                                      placeholder="Add notes..."
                                      rows={2}
                                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-[11px] text-[#1d1d1f] focus:outline-none"
                                    />
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => saveLeadNotes(lead.id)}
                                        disabled={updatingId === lead.id}
                                        className="bg-slate-900 text-white px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer"
                                      >
                                        {updatingId === lead.id ? <Loader2 size={10} className="animate-spin" /> : 'Save'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingNotesId(null)}
                                        className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-slate-700 text-[11px] italic leading-snug">
                                    {lead.notes || 'No notes yet.'}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Card Footer: WhatsApp + Expand/Collapse + Next Stage */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setKanbanExpandedId((prev) => (prev === lead.id ? null : lead.id))
                                fetchPaymentLogs(lead.id)
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp size={11} className="text-slate-500" /> Less
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={11} className="text-slate-500" /> Expand
                                </>
                              )}
                            </button>

                            <div className="flex items-center gap-1 ml-auto">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveLeadModalId(lead.id)
                                  fetchPaymentLogs(lead.id)
                                }}
                                className="text-[9px] font-bold text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-0.5 cursor-pointer mr-0.5"
                                title="Open full dialog popup"
                              >
                                Pop-up ↗
                              </button>
                              {stageKey !== 'delivered' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStageMove(lead.id, NEXT_STAGE[stageKey])
                                  }}
                                  className="flex items-center gap-0.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
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
                    onClick={() => { setActiveLeadModalId(lead.id); fetchPaymentLogs(lead.id) }}
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 text-[#e3231c] flex items-center justify-center shrink-0">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1d1d1f]">Create New Deal / Lead</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Add client contact, order quotation items, and requirements</p>
                </div>
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

              {/* Order Quotation Specification (Multi-Item Order CRUD) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Tag size={12} className="text-[#e3231c]" /> Order Quotation & Items ({newLeadItems.length})
                    </span>
                    <span className="text-[10px] text-slate-400">Add products, fabric/material specs, quantities & rates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
                      Total Quote: {fmt(newLeadTotalQuote)}
                    </span>
                    <button
                      type="button"
                      onClick={addEmptyNewLeadItem}
                      className="bg-slate-900 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Item
                    </button>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {newLeadItems.map((item, idx) => (
                    <div key={item.id || idx} className="bg-white border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          Item #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200/60">
                            {fmt((parseFloat(String(item.quantity)) || 0) * (parseFloat(String(item.unit_price)) || 0))}
                          </span>
                          {newLeadItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeNewLeadItem(idx)}
                              className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="col-span-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Product / Item Name *</label>
                          <input
                            type="text"
                            required
                            value={item.name}
                            onChange={(e) => updateNewLeadItem(idx, 'name', e.target.value)}
                            placeholder="e.g. 100x Canvas Bags, 250x Cotton Polos"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1d1d1f] focus:outline-none focus:border-slate-800"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Quality / Fabric / Material Specs</label>
                          <input
                            type="text"
                            value={item.quality}
                            onChange={(e) => updateNewLeadItem(idx, 'quality', e.target.value)}
                            placeholder="e.g. 120 GSM cotton canvas, dual-tone handle"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Quantity *</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateNewLeadItem(idx, 'quantity', e.target.value)}
                            placeholder="100"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1d1d1f] focus:outline-none focus:border-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Unit Price (₹) *</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_price}
                            onChange={(e) => updateNewLeadItem(idx, 'unit_price', e.target.value)}
                            placeholder="500"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1d1d1f] focus:outline-none focus:border-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addEmptyNewLeadItem}
                  className="w-full py-2 border border-dashed border-slate-300 hover:border-slate-500 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} /> Add Another Product / Item
                </button>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Special Requirements & Brief</label>
                <textarea
                  value={newLead.requirements}
                  onChange={(e) => setNewLead({ ...newLead, requirements: e.target.value })}
                  placeholder="Custom branding details, sample requirements, deadline..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-[#1d1d1f] focus:outline-none focus:border-slate-400"
                />
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

      {/* ─── EXCEL IMPORT MODAL ─────────────────────────────────────────── */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => { if (!isSubmittingImport) setIsImportModalOpen(false) }}
        >
          <div
            className="bg-white rounded-[28px] border border-slate-200/90 shadow-[0_25px_70px_rgba(0,0,0,0.3)] max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1d1d1f]">Import Leads & Orders from Excel</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Upload an Excel spreadsheet (<span className="font-mono text-emerald-700 font-bold">.xlsx</span>) to batch import inquiries and quotations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (!isSubmittingImport) setIsImportModalOpen(false) }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Template Download Callout */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-600" /> Need the standard column format?
                  </span>
                  <p className="text-[11px] text-emerald-800/80 font-medium">
                    Download our styled sample Excel template pre-filled with example orders, specs, and stages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleLeadsTemplate}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer"
                >
                  <Download size={13} /> Download Sample Template
                </button>
              </div>

              {/* Upload Dropzone */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
                  Select Excel File (.xlsx)
                </label>
                <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/20 rounded-2xl p-6 text-center transition-all cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                      {isParsingExcel ? <Loader2 size={22} className="animate-spin text-emerald-600" /> : <Upload size={22} className="text-slate-500" />}
                    </div>
                    {importFile ? (
                      <div>
                        <p className="text-xs font-bold text-slate-900">{importFile.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{(importFile.size / 1024).toFixed(1)} KB • Click or drop to replace</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-slate-700">Click to browse or drag & drop your Excel file here</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Supports Microsoft Excel (.xlsx, .xls)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {importError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-rose-800 text-xs">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{importError}</span>
                </div>
              )}

              {/* Preview Table if rows parsed */}
              {parsedImportRows.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      Preview: {parsedImportRows.length} Valid Deals Ready to Import
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Showing first {Math.min(parsedImportRows.length, 6)} rows
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-56">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-900 text-white font-bold">
                            <th className="p-2.5 pl-3">Contact</th>
                            <th className="p-2.5">Company</th>
                            <th className="p-2.5">Product & Specs</th>
                            <th className="p-2.5 text-right">Deal Value</th>
                            <th className="p-2.5 text-center">Stage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {parsedImportRows.slice(0, 8).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 pl-3 font-bold text-slate-900">
                                {row.name}
                                {row.phone && <span className="block text-[9px] text-slate-400 font-normal">{row.phone}</span>}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-700">{row.company}</td>
                              <td className="p-2.5 text-slate-600">
                                {row.product_name || 'Custom Order'}
                                {row.quality && <span className="block text-[9px] text-slate-400 font-medium">({row.quality})</span>}
                              </td>
                              <td className="p-2.5 text-right font-black text-slate-900">
                                {fmt(Number(row.deal_value) || 0)}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold capitalize bg-slate-100 text-slate-700 border border-slate-200">
                                  {row.status || 'conversation'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => { setIsImportModalOpen(false); setImportFile(null); setParsedImportRows([]); setImportError(null) }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                disabled={isSubmittingImport}
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={parsedImportRows.length === 0 || isSubmittingImport}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                >
                  {isSubmittingImport ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Importing {parsedImportRows.length} Leads...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Confirm & Import {parsedImportRows.length > 0 ? `(${parsedImportRows.length})` : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── COMPLETE LEAD DETAIL POPUP MODAL ───────────────────────────── */}
      {currentModalLead && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setActiveLeadModalId(null)}
        >
          <div
            className="bg-white rounded-[28px] border border-slate-200/90 shadow-[0_25px_70px_rgba(0,0,0,0.3)] max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── MODAL HEADER ── */}
            <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/60 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md">
                  {currentModalLead.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-[#1d1d1f] tracking-tight leading-snug truncate">
                      {currentModalLead.name}
                    </h2>
                    {/* Current Stage Pill */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-xs font-bold ${STAGE_CONFIG[currentModalLead.status]?.badgeBg} ${STAGE_CONFIG[currentModalLead.status]?.badgeText}`}>
                      <span className={`w-2 h-2 rounded-full ${STAGE_CONFIG[currentModalLead.status]?.dot}`} />
                      {STAGE_CONFIG[currentModalLead.status]?.label}
                    </span>
                    {/* Source Pill */}
                    {(() => {
                      const src = getSourceConfig(currentModalLead.source)
                      const SIcon = src.icon
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-xs font-bold ${src.bg} ${src.text} ${src.border}`}>
                          <SIcon size={12} />
                          {src.label}
                        </span>
                      )
                    })()}
                  </div>
                  <p className="text-xs text-slate-500 font-semibold flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-slate-700 font-bold">
                      <Building2 size={13} className="text-slate-400 shrink-0" />
                      {currentModalLead.company}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400">Created on {fmtDate(currentModalLead.created_at)}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400">Updated {fmtDateTime(currentModalLead.updated_at)}</span>
                  </p>
                </div>
              </div>

              {/* Header Actions & Close */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyLeadInfo(currentModalLead)}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                  title="Copy deal details"
                >
                  {copiedSummary ? <><Check size={13} className="text-emerald-600" /> Copied!</> : <><Copy size={13} /> Copy Info</>}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLeadModalId(null)}
                  className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* ── INTERACTIVE 6-STAGE PIPELINE STEPPER ── */}
            <div className="px-6 py-3 bg-white border-b border-slate-100 overflow-x-auto">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                Pipeline Stage (Click any stage to advance lead)
              </p>
              <div className="flex items-center gap-1.5 min-w-[660px]">
                {STAGE_ORDER.map((stageKey, idx) => {
                  const cfg = STAGE_CONFIG[stageKey]
                  const StageIcon = cfg.icon
                  const isCurrent = currentModalLead.status === stageKey
                  const isPast = STAGE_ORDER.indexOf(currentModalLead.status) > idx

                  return (
                    <React.Fragment key={stageKey}>
                      <button
                        type="button"
                        onClick={() => handleStageMove(currentModalLead.id, stageKey)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          isCurrent
                            ? `${cfg.badgeBg} ${cfg.badgeText} ring-2 ring-current/20 shadow-xs scale-[1.02]`
                            : isPast
                            ? 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-slate-100'
                            : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600'
                        }`}
                      >
                        <StageIcon size={12} className={isCurrent ? 'animate-pulse' : ''} />
                        <span className="truncate">{cfg.label}</span>
                        {isPast && <Check size={11} className="text-emerald-500 shrink-0" />}
                      </button>
                      {idx < STAGE_ORDER.length - 1 && (
                        <ChevronRight size={13} className="text-slate-300 shrink-0" />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            {/* ── QUICK CONTACT ACTION BAR ── */}
            <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {currentModalLead.phone && (
                  <a
                    href={getWhatsAppLink(currentModalLead.phone, currentModalLead.name, currentModalLead.product_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-xs transition-all"
                  >
                    <MessageSquare size={13} /> Chat on WhatsApp
                  </a>
                )}
                {currentModalLead.phone && (
                  <a
                    href={`tel:${currentModalLead.phone}`}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                  >
                    <Phone size={12} /> Call {currentModalLead.phone}
                  </a>
                )}
                <a
                  href={`mailto:${currentModalLead.email}`}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                >
                  <Mail size={12} /> Email {currentModalLead.email}
                </a>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteLead(currentModalLead.id)}
                disabled={isDeletingLead}
                className="text-xs font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1 ml-auto"
              >
                {isDeletingLead ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete Deal
              </button>
            </div>

            {/* ── MODAL SCROLLABLE BODY ── */}
            {(() => {
              const modalFinancials = getFinancials(currentModalLead)
              const { items: modalItems, orderTotal: modalOrderTotal, totalPaid: modalTotalPaid, balanceDue: modalBalanceDue, percentPaid: modalPercentPaid } = modalFinancials
              const isAddingItemModal = isAddingItemLeadId === currentModalLead.id

              return (
                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* LEFT COLUMN: Quotation Builder, Requirements & Notes (7 cols) */}
                    <div className="lg:col-span-7 space-y-5">
                      
                      {/* 1. ORDER QUOTATION & SPECIFICATIONS BUILDER */}
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Package size={14} className="text-[#e3231c]" />
                              Order Quotation & Items ({modalItems.length})
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Add bags, apparel, or gifts with fabric/quality specs & pricing</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#1d1d1f] bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                              Deal Value: {fmt(modalOrderTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingItemLeadId(isAddingItemModal ? null : currentModalLead.id)
                                setNewItemForm({ name: '', quality: '', quantity: '100', unit_price: '500' })
                              }}
                              className="bg-[#1d1d1f] hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Plus size={12} /> Add Item
                            </button>
                          </div>
                        </div>

                        {/* Add Item Form */}
                        {isAddingItemModal && (
                          <div className="bg-white border-2 border-slate-800/20 rounded-2xl p-4 space-y-3 shadow-md animate-in slide-in-from-top-2 duration-150">
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                              <span className="text-xs font-black text-[#1d1d1f]">Add Product / Item to Quotation</span>
                              <button
                                type="button"
                                onClick={() => setIsAddingItemLeadId(null)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5 text-xs">
                              <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Item / Product Name *
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 100x Canvas Bags, 250x Cotton Polos"
                                  value={newItemForm.name}
                                  onChange={(e) => setNewItemForm((p) => ({ ...p, name: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-[#1d1d1f] focus:outline-none focus:border-slate-800"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Quality / Fabric / Material Specs
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 120 GSM Cotton Canvas, 220 GSM Bio-washed, Screen Printed Logo"
                                  value={newItemForm.quality}
                                  onChange={(e) => setNewItemForm((p) => ({ ...p, quality: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-[#1d1d1f] focus:outline-none focus:border-slate-800"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Quantity *
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={newItemForm.quantity}
                                  onChange={(e) => setNewItemForm((p) => ({ ...p, quantity: e.target.value }))}
                                  placeholder="100"
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-[#1d1d1f] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Unit Price (₹) *
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={newItemForm.unit_price}
                                  onChange={(e) => setNewItemForm((p) => ({ ...p, unit_price: e.target.value }))}
                                  placeholder="500"
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-[#1d1d1f] focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <span className="text-xs font-black text-slate-800">
                                Item Total: {fmt((parseFloat(newItemForm.quantity) || 0) * (parseFloat(newItemForm.unit_price) || 0))}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setIsAddingItemLeadId(null)}
                                  className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingItems}
                                  onClick={() => handleAddItem(currentModalLead.id)}
                                  className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  {isSavingItems ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                  Add to Quote
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Items List */}
                        {modalItems.length > 0 ? (
                          <div className="space-y-2">
                            {modalItems.map((item, idx) => {
                              const isEditingThis = editingItemId === item.id

                              if (isEditingThis) {
                                return (
                                  <div key={item.id} className="bg-white border-2 border-slate-300 rounded-xl p-3 space-y-2.5 shadow-xs text-xs">
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        placeholder="Item name"
                                        value={editItemForm.name}
                                        onChange={(e) => setEditItemForm((p) => ({ ...p, name: e.target.value }))}
                                        className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Quality / Specs"
                                        value={editItemForm.quality}
                                        onChange={(e) => setEditItemForm((p) => ({ ...p, quality: e.target.value }))}
                                        className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                                      />
                                      <input
                                        type="number"
                                        placeholder="Quantity"
                                        value={editItemForm.quantity}
                                        onChange={(e) => setEditItemForm((p) => ({ ...p, quantity: e.target.value }))}
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                                      />
                                      <input
                                        type="number"
                                        placeholder="Unit Price (₹)"
                                        value={editItemForm.unit_price}
                                        onChange={(e) => setEditItemForm((p) => ({ ...p, unit_price: e.target.value }))}
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                      <span className="text-xs font-bold text-slate-700">
                                        Total: {fmt((parseFloat(editItemForm.quantity) || 0) * (parseFloat(editItemForm.unit_price) || 0))}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setEditingItemId(null)}
                                          className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveEditedItem(currentModalLead.id)}
                                          className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                                        >
                                          Save Changes
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              return (
                                <div
                                  key={item.id}
                                  className="group bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-2xs hover:shadow-xs transition-all"
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0 border border-slate-200/80">
                                      #{idx + 1}
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-slate-900 text-sm">{item.name}</span>
                                        {item.quality ? (
                                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px] font-semibold">
                                            <Tag size={9} className="text-slate-400" />
                                            {item.quality}
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditItem(item)}
                                            className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 underline cursor-pointer"
                                          >
                                            + add quality specs
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                                        <span className="font-bold text-slate-800">{item.quantity} units</span>
                                        <span className="text-slate-300">×</span>
                                        <span>{fmt(Number(item.unit_price))} each</span>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                      <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider text-[9px]">Line Total</span>
                                      <span className="text-base font-black text-slate-900">{fmt(Number(item.total))}</span>
                                    </div>
                                    <div className="flex items-center gap-1 border-l border-slate-100 pl-2">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditItem(item)}
                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                                        title="Edit item name, quantity or price"
                                      >
                                        <PenLine size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem(currentModalLead.id, item.id)}
                                        className="p-1.5 rounded-lg border border-rose-100 text-rose-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer"
                                        title="Delete item from quote"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center">
                            <Package size={24} className="mx-auto text-slate-300 mb-1.5" />
                            <p className="text-xs font-bold text-slate-700">No quotation items added yet</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Click "+ Add Item" above to specify products, quality specs, quantities & rates.</p>
                          </div>
                        )}
                      </div>

                      {/* 2. Client Specifications & Brief (Fully Editable) */}
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Tag size={13} className="text-[#e3231c]" />
                            Client Specifications & Brief
                          </h4>
                          {editingRequirementsId !== currentModalLead.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRequirementsId(currentModalLead.id)
                                setRequirementsContent(currentModalLead.requirements || '')
                              }}
                              className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1 hover:underline"
                            >
                              <PenLine size={11} /> Edit Brief
                            </button>
                          )}
                        </div>

                        {editingRequirementsId === currentModalLead.id ? (
                          <div className="space-y-2.5">
                            <textarea
                              value={requirementsContent}
                              onChange={(e) => setRequirementsContent(e.target.value)}
                              placeholder="Enter client customization specifications, fabric requirements, delivery deadlines, branding guidelines..."
                              rows={4}
                              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-800"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveRequirements(currentModalLead.id)}
                                disabled={isSavingRequirements}
                                className="bg-slate-900 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl hover:bg-black transition-all cursor-pointer flex items-center gap-1"
                              >
                                {isSavingRequirements ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Save Brief
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRequirementsId(null)}
                                className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1.5 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[50px] shadow-2xs">
                            {currentModalLead.requirements || (
                              <span className="italic text-slate-400">
                                No specific requirements submitted. Click "Edit Brief" to record fabric requirements, branding placements, or delivery deadlines.
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 3. Internal Sales Notes Card */}
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText size={13} className="text-slate-600" />
                            Internal Sales Notes
                          </h4>
                          {editingNotesId !== currentModalLead.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNotesId(currentModalLead.id)
                                setNoteContent(currentModalLead.notes || '')
                              }}
                              className="text-xs font-bold text-[#e3231c] hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <PenLine size={11} /> Edit Note
                            </button>
                          )}
                        </div>

                        {editingNotesId === currentModalLead.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                              placeholder="Enter dispatch notes, sample feedback, negotiated terms..."
                              rows={4}
                              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-slate-800"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveLeadNotes(currentModalLead.id)}
                                disabled={updatingId === currentModalLead.id}
                                className="bg-slate-900 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl hover:bg-black transition-all cursor-pointer flex items-center gap-1"
                              >
                                {updatingId === currentModalLead.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Save Note
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingNotesId(null)}
                                className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1.5 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed italic min-h-[50px] shadow-2xs">
                            {currentModalLead.notes || 'No sales notes recorded yet. Click "Edit Note" to add dispatch details, sample feedback, or order progress.'}
                          </div>
                        )}
                      </div>

                      {/* 4. Customer Overview Card (with quick edit) */}
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 size={13} className="text-slate-600" />
                            Customer Overview
                          </h4>
                          {!isEditingContactInfo && (
                            <button
                              type="button"
                              onClick={() => handleStartEditContact(currentModalLead)}
                              className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1 hover:underline"
                            >
                              <PenLine size={11} /> Edit Contact
                            </button>
                          )}
                        </div>

                        {isEditingContactInfo ? (
                          <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Contact Name *</label>
                                <input
                                  type="text"
                                  value={editContactForm.name}
                                  onChange={(e) => setEditContactForm((p) => ({ ...p, name: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Company *</label>
                                <input
                                  type="text"
                                  value={editContactForm.company}
                                  onChange={(e) => setEditContactForm((p) => ({ ...p, company: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Email *</label>
                                <input
                                  type="email"
                                  value={editContactForm.email}
                                  onChange={(e) => setEditContactForm((p) => ({ ...p, email: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Phone</label>
                                <input
                                  type="text"
                                  value={editContactForm.phone}
                                  onChange={(e) => setEditContactForm((p) => ({ ...p, phone: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setIsEditingContactInfo(false)}
                                className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSavingContactInfo}
                                onClick={() => handleSaveContactInfo(currentModalLead.id)}
                                className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                              >
                                {isSavingContactInfo ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Save Contact
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Contact Person</span>
                              <span className="font-bold text-[#1d1d1f] text-sm">{currentModalLead.name}</span>
                            </div>
                            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Company</span>
                              <span className="font-bold text-[#1d1d1f] text-sm">{currentModalLead.company}</span>
                            </div>
                            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Email</span>
                              <a href={`mailto:${currentModalLead.email}`} className="font-bold text-blue-600 hover:underline truncate block">
                                {currentModalLead.email}
                              </a>
                            </div>
                            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Phone</span>
                              <span className="font-bold text-[#1d1d1f]">{currentModalLead.phone || 'N/A'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* RIGHT COLUMN: Financial Summary & Payment Tranches (5 cols) */}
                    <div className="lg:col-span-5 space-y-5">
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                        
                        {/* Financial Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <ReceiptText size={14} className="text-emerald-600" />
                              Payment Tranches & Clearance
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Track advances, partial payments & final settlements</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openAddPaymentForm(currentModalLead)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Plus size={12} /> Log Payment
                          </button>
                        </div>

                        {/* 3-Metric Financial Cards */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Total Order</span>
                            <span className="text-sm font-black text-slate-900 block truncate">{fmt(modalOrderTotal)}</span>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2.5 shadow-2xs">
                            <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">Collected</span>
                            <span className="text-sm font-black text-emerald-700 block truncate">{fmt(modalTotalPaid)}</span>
                          </div>
                          <div className={`rounded-xl p-2.5 shadow-2xs border ${modalBalanceDue > 0 ? 'bg-amber-50 border-amber-200/80' : 'bg-slate-50 border-slate-200'}`}>
                            <span className={`text-[9px] font-bold uppercase tracking-wider block mb-0.5 ${modalBalanceDue > 0 ? 'text-amber-700' : 'text-slate-400'}`}>Balance Due</span>
                            <span className={`text-sm font-black block truncate ${modalBalanceDue > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{fmt(modalBalanceDue)}</span>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        {modalOrderTotal > 0 && (
                          <div className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-1.5 shadow-2xs">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700">{modalPercentPaid}% Collected</span>
                              <span className="text-[10px] font-semibold text-slate-400">
                                {modalBalanceDue === 0 ? 'Fully settled ✓' : `${fmt(modalBalanceDue)} pending`}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${modalBalanceDue === 0 ? 'bg-emerald-500' : 'bg-emerald-600'}`}
                                style={{ width: `${modalPercentPaid}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Add Payment Form (if open) */}
                        {addPaymentLeadId === currentModalLead.id && (
                          <form
                            onSubmit={(e) => handleAddPayment(e, currentModalLead.id)}
                            className="bg-white border-2 border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-md animate-in slide-in-from-top-2 duration-150"
                          >
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                              <div>
                                <span className="text-xs font-black text-[#1d1d1f] block">Record Payment Tranche</span>
                                <span className="text-[10px] text-slate-400">Money received from client towards order</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setAddPaymentLeadId(null)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            <div className="space-y-2.5 text-xs">
                              {/* Payment Stage */}
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Payment Stage *
                                </label>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['advance', 'partial', 'final'] as const).map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => setNewPayment((p) => ({ ...p, payment_type: t }))}
                                      className={`py-1.5 px-2 rounded-xl font-bold text-[11px] capitalize border transition-all cursor-pointer ${
                                        newPayment.payment_type === t
                                          ? `${PAYMENT_TYPE_CONFIG[t].bg} ${PAYMENT_TYPE_CONFIG[t].text} ${PAYMENT_TYPE_CONFIG[t].border} ring-2 ring-current/20 shadow-xs`
                                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      {PAYMENT_TYPE_CONFIG[t].label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Amount Received */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Amount Received (₹) *
                                  </label>
                                  {modalBalanceDue > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setNewPayment((p) => ({ ...p, amount: String(modalBalanceDue) }))}
                                      className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                                    >
                                      Full Balance ({fmt(modalBalanceDue)})
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="number"
                                  step="any"
                                  required
                                  value={newPayment.amount}
                                  onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))}
                                  placeholder="e.g. 15000"
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-black text-sm text-[#1d1d1f] focus:outline-none focus:border-slate-800"
                                />
                              </div>

                              {/* Payment Method & Date */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Payment Method
                                  </label>
                                  <select
                                    value={newPayment.payment_method}
                                    onChange={(e) => setNewPayment((p) => ({ ...p, payment_method: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
                                  >
                                    <option value="UPI">UPI / QR</option>
                                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Card">Card</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Date & Time
                                  </label>
                                  <input
                                    type="datetime-local"
                                    value={newPayment.payment_date}
                                    onChange={(e) => setNewPayment((p) => ({ ...p, payment_date: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium focus:outline-none"
                                  />
                                </div>
                              </div>

                              {/* Notes / Reference */}
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Reference / Transaction Note
                                </label>
                                <input
                                  type="text"
                                  value={newPayment.notes}
                                  onChange={(e) => setNewPayment((p) => ({ ...p, notes: e.target.value }))}
                                  placeholder="e.g. UPI Ref #439281, 50% advance for raw materials"
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                                />
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => setAddPaymentLeadId(null)}
                                  className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isSubmittingPayment}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                                >
                                  {isSubmittingPayment ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                  Save Payment
                                </button>
                              </div>
                            </div>
                          </form>
                        )}

                        {/* Transactions List */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            Transaction History ({(paymentLogsByLeadId[currentModalLead.id] || []).length})
                          </p>
                          {loadingPaymentLogs.has(currentModalLead.id) ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs">
                              <Loader2 size={14} className="animate-spin" /> Loading transactions...
                            </div>
                          ) : (paymentLogsByLeadId[currentModalLead.id] || []).length === 0 ? (
                            <div className="text-center py-6 bg-white border border-dashed border-slate-200 rounded-2xl p-4">
                              <ReceiptText size={22} className="mx-auto text-slate-300 mb-1.5" />
                              <p className="text-xs font-semibold text-slate-500">No payment tranches recorded</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Click "+ Log Payment" to record an advance or clearance.</p>
                            </div>
                          ) : (
                            (paymentLogsByLeadId[currentModalLead.id] || []).map((log) => {
                              const ptc = PAYMENT_TYPE_CONFIG[log.payment_type as keyof typeof PAYMENT_TYPE_CONFIG] || PAYMENT_TYPE_CONFIG.advance
                              const isDeleting = deletingPaymentLogId === log.id

                              return (
                                <div
                                  key={log.id}
                                  className="bg-white border border-slate-200/90 rounded-2xl p-3.5 space-y-2 shadow-2xs hover:shadow-xs transition-shadow"
                                >
                                  {(() => {
                                    const parsed = parseLogNotes(log.notes)
                                    return (
                                      <>
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${ptc.bg} ${ptc.text} ${ptc.border}`}>
                                              {ptc.label}
                                            </span>
                                            {parsed.method && (
                                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                                {parsed.method}
                                              </span>
                                            )}
                                            <span className="text-sm font-black text-slate-900 ml-1">
                                              {fmt(Number(log.total_amount))}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePaymentLog(log.id, currentModalLead.id)}
                                            disabled={isDeleting}
                                            className="text-slate-300 hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer"
                                            title="Delete transaction"
                                          >
                                            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
                                          </button>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-100 flex-wrap gap-1.5">
                                          <span className="flex items-center gap-1 text-slate-500 font-medium text-[10px]">
                                            <Clock size={11} className="text-slate-400" />
                                            {fmtDateTime(log.payment_date)}
                                          </span>
                                          {parsed.note && (
                                            <span className="text-slate-700 font-medium text-xs max-w-[240px] truncate" title={parsed.note}>
                                              {parsed.note}
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    )
                                  })()}
                                </div>
                              )
                            })
                          )}
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              )
            })()}

          </div>
        </div>
      )}

    </div>
  )
}
