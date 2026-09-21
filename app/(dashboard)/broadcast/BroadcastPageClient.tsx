'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  MessageCircle, Send, Users, ShoppingBag, Briefcase, CheckCircle2,
  AlertTriangle, Loader2, Phone, Check, Megaphone, ShieldCheck,
  Tag, Gift, ArrowRight, Eye, Image as ImageIcon,
  Link as LinkIcon, Upload, X, ExternalLink, ChevronLeft, PhoneCall,
  Video, MoreVertical, Paperclip, Smile, Mic, Shirt, Globe,
  Palette, Truck, CheckCheck, Search, Filter, CheckSquare, Square,
  RotateCcw, ArrowUpDown, SlidersHorizontal, Building2, Calendar,
  BadgePercent, UserCheck, Trash2, FolderOpen, RefreshCw, Maximize2
} from 'lucide-react'
import { getAdminCache, setAdminCache } from '@/lib/adminCache'

export interface UploadedMediaItem {
  id: string
  name: string
  path: string
  url: string
  createdAt?: string
  sizeKb?: string
}

export interface BroadcastContact {
  id: string
  phone: string
  name: string
  source: 'retail' | 'lead' | 'customer' | 'custom'
  meta?: string
  date?: string
  totalSpent?: number
  ordersCount?: number
  status?: string
  company?: string
  hasCustomPrint?: boolean
  email?: string
  authProvider?: string
}

export interface AudienceCounts {
  retailCustomersCount: number
  leadsCount: number
  registeredCustomersCount?: number
  totalUniqueContacts: number
}

interface BroadcastPageClientProps {
  initialCounts: AudienceCounts
  initialContacts?: BroadcastContact[]
}

const PRESET_CAMPAIGNS = [
  {
    id: 'festive_gifting',
    title: 'Executive Corporate Gifting Collection',
    category: 'Corporate Gifting',
    icon: Gift,
    mediaUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=1000&auto=format&fit=crop',
    linkUrl: 'https://outflank.in/products',
    buttonText: 'View Corporate Catalog',
    message: `Outflank Executive Corporate Gifting Collection\n\nElevate your organization's stakeholder appreciation with our curated bespoke gift hampers, luxury apparel, and precision-crafted drinkware.\n\nVolume benefits on orders of 50+ units include complimentary brand identity embroidery, dedicated account concierge, and PAN-India scheduled dispatch.\n\nExplore our corporate catalog via the link below or reply directly to this message.`,
  },
  {
    id: 'custom_polo',
    title: '240 GSM Bio-Washed Piqué Polo Program',
    category: 'Custom Apparel',
    icon: Shirt,
    mediaUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?q=80&w=1000&auto=format&fit=crop',
    linkUrl: 'https://outflank.in/customize',
    buttonText: 'Configure Custom Polos',
    message: `Outflank Bespoke 240 GSM Piqué Polo Program\n\nEquip your team with institutional-grade bio-washed organic cotton polos engineered for executive comfort and long-term durability.\n\nComplimentary 3D digital sample mockups prepared within 24 hours. Tiered enterprise wholesale pricing applies.\n\nAccess our interactive customizer via the link below.`,
  },
  {
    id: 'vip_loyalty',
    title: 'Client Loyalty Privilege Program',
    category: 'Client Loyalty',
    icon: ShoppingBag,
    mediaUrl: '',
    linkUrl: 'https://outflank.in',
    buttonText: 'Access Preferred Rate',
    message: `Outflank Client Loyalty Privilege\n\nHello {name}, as a valued Outflank client, we are pleased to extend an exclusive 10% preferred rate on your subsequent merchandise or gifting requisition.\n\nApply code VIP10 during checkout on outflank.in. Valid for 7 days across our complete catalog.`,
  },
]

const SAMPLE_IMAGES = [
  {
    label: 'Corporate Hampers',
    url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=1000&auto=format&fit=crop',
  },
  {
    label: 'Apparel & Polos',
    url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?q=80&w=1000&auto=format&fit=crop',
  },
  {
    label: 'Executive Desk Sets',
    url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1000&auto=format&fit=crop',
  },
]

const PRESET_LINKS = [
  { label: 'Storefront', url: 'https://outflank.in', buttonText: 'Visit Outflank' },
  { label: 'Corporate Catalog', url: 'https://outflank.in/products', buttonText: 'View Corporate Catalog' },
  { label: 'Custom Studio', url: 'https://outflank.in/customize', buttonText: 'Design Custom Apparel' },
  { label: 'Order Tracking', url: 'https://outflank.in/track', buttonText: 'Track Consignment' },
]

export default function BroadcastPageClient({
  initialCounts,
  initialContacts = [],
}: BroadcastPageClientProps) {
  const [counts, setCounts] = useState<AudienceCounts>(() => {
    if (initialCounts) return initialCounts
    const cached = getAdminCache<AudienceCounts>('outflank_admin_broadcast_counts', 10 * 60 * 1000, 'session')
    return cached?.data || initialCounts
  })
  const [allContacts, setAllContacts] = useState<BroadcastContact[]>(() => {
    if (initialContacts && initialContacts.length > 0) return initialContacts
    const cached = getAdminCache<BroadcastContact[]>('outflank_admin_broadcast_contacts', 10 * 60 * 1000, 'session')
    return cached?.data || initialContacts
  })

  useEffect(() => {
    if (initialContacts && initialContacts.length > 0) {
      setAllContacts(initialContacts)
      setAdminCache('outflank_admin_broadcast_contacts', initialContacts, 'session')
    }
    if (initialCounts) {
      setCounts(initialCounts)
      setAdminCache('outflank_admin_broadcast_counts', initialCounts, 'session')
    }
  }, [initialContacts, initialCounts])

  const [targetAudience, setTargetAudience] = useState<'retail_customers' | 'registered_customers' | 'leads' | 'all' | 'custom'>('all')
  const [customNumbersInput, setCustomNumbersInput] = useState('')
  const [contactSearchQuery, setContactSearchQuery] = useState('')
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(
    () => new Set((initialContacts.length > 0 ? initialContacts : allContacts).map((c) => c.phone))
  )

  const [campaignTitle, setCampaignTitle] = useState('Executive Corporate Gifting Collection')
  const [messageText, setMessageText] = useState(PRESET_CAMPAIGNS[0].message)
  const [activePreset, setActivePreset] = useState<string>('festive_gifting')

  // Attachments state
  const [mediaUrl, setMediaUrl] = useState<string>(PRESET_CAMPAIGNS[0].mediaUrl)
  const [linkUrl, setLinkUrl] = useState<string>(PRESET_CAMPAIGNS[0].linkUrl)
  const [buttonText, setButtonText] = useState<string>(PRESET_CAMPAIGNS[0].buttonText)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadedImageSize, setUploadedImageSize] = useState<string | null>(null)
  const [libraryFiles, setLibraryFiles] = useState<UploadedMediaItem[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [showLibraryPanel, setShowLibraryPanel] = useState(true)
  const [previewFit, setPreviewFit] = useState<'natural' | 'cover'>('natural')
  const [imageAspectRatio, setImageAspectRatio] = useState<'square' | 'landscape' | 'portrait' | 'auto'>('landscape')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const phoneChatRef = useRef<HTMLDivElement>(null)

  // Current formatted time for mockup
  const [currentTime, setCurrentTime] = useState('21:30')
  useEffect(() => {
    const now = new Date()
    setCurrentTime(
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    )
  }, [])

  // Auto-scroll phone mockup to bottom on content update
  useEffect(() => {
    if (phoneChatRef.current) {
      phoneChatRef.current.scrollTop = phoneChatRef.current.scrollHeight
    }
  }, [])

  // Test send state
  const [testPhone, setTestPhone] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testStatus, setTestStatus] = useState<{ success?: boolean; error?: string } | null>(null)

  // Broadcast execution state
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{
    totalRecipients: number
    sentCount: number
    failedCount: number
    results: any[]
  } | null>(null)
  const [broadcastError, setBroadcastError] = useState<string | null>(null)

  // Parse pasted custom phone numbers into typed BroadcastContact objects
  const parsedCustomContacts = useMemo<BroadcastContact[]>(() => {
    if (targetAudience !== 'custom' || !customNumbersInput.trim()) return []
    const lines = customNumbersInput
      .split(/[\n,;]+/)
      .map((s) => s.replace(/\D/g, '').trim())
      .filter((s) => s.length >= 10)

    const uniqueClean = Array.from(new Set(lines)).map((num) =>
      num.length === 10 ? `91${num}` : num
    )

    return uniqueClean.map((phone, idx) => ({
      id: `custom_${idx}_${phone}`,
      phone,
      name: `Manual Contact ${idx + 1}`,
      source: 'custom',
      meta: 'Pasted Mobile Number',
    }))
  }, [customNumbersInput, targetAudience])

  // Get current active contacts list based on audience tab
  const activeContactsList = useMemo<BroadcastContact[]>(() => {
    if (targetAudience === 'registered_customers') {
      return allContacts.filter((c) => c.source === 'customer' || Boolean(c.authProvider))
    }
    if (targetAudience === 'retail_customers') {
      return allContacts.filter((c) => c.source === 'retail' || (c.ordersCount && c.ordersCount > 0))
    }
    if (targetAudience === 'leads') {
      return allContacts.filter((c) => c.source === 'lead')
    }
    if (targetAudience === 'custom') {
      return parsedCustomContacts
    }
    return allContacts
  }, [targetAudience, allContacts, parsedCustomContacts])

  // Keep selection in sync when switching audience segment
  useEffect(() => {
    setSelectedPhones(new Set(activeContactsList.map((c) => c.phone)))
  }, [activeContactsList])

  // Granular customer filtering & sorting state
  const [filterSegment, setFilterSegment] = useState<'all' | 'high_value' | 'custom_print' | 'repeat' | 'qualified' | 'recent_30d'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [minSpendFilter, setMinSpendFilter] = useState<number>(0)
  const [sortBy, setSortBy] = useState<'spend_desc' | 'recent' | 'orders_desc' | 'name_asc'>('spend_desc')

  // Dynamic segment counts calculated on current audience channel
  const segmentCounts = useMemo(() => {
    const highValueCount = activeContactsList.filter((c) => (c.totalSpent || 0) >= 1000).length
    const customPrintCount = activeContactsList.filter((c) => Boolean(c.hasCustomPrint)).length
    const repeatCount = activeContactsList.filter((c) => (c.ordersCount || 0) > 1).length
    const qualifiedCount = activeContactsList.filter((c) => c.status === 'qualified' || c.status === 'in_progress').length
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const recentCount = activeContactsList.filter((c) => c.date && new Date(c.date).getTime() >= thirtyDaysAgo).length

    return {
      all: activeContactsList.length,
      high_value: highValueCount,
      custom_print: customPrintCount,
      repeat: repeatCount,
      qualified: qualifiedCount,
      recent_30d: recentCount,
    }
  }, [activeContactsList])

  // Filtered & sorted contacts pipeline
  const filteredAndSortedContacts = useMemo(() => {
    let list = [...activeContactsList]

    // 1. Segment pill filter
    if (filterSegment === 'high_value') {
      list = list.filter((c) => (c.totalSpent || 0) >= 1000)
    } else if (filterSegment === 'custom_print') {
      list = list.filter((c) => Boolean(c.hasCustomPrint))
    } else if (filterSegment === 'repeat') {
      list = list.filter((c) => (c.ordersCount || 0) > 1)
    } else if (filterSegment === 'qualified') {
      list = list.filter((c) => c.status === 'qualified' || c.status === 'in_progress')
    } else if (filterSegment === 'recent_30d') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      list = list.filter((c) => c.date && new Date(c.date).getTime() >= thirtyDaysAgo)
    }

    // 2. Order/Lead Status filter
    if (statusFilter !== 'all') {
      list = list.filter((c) => (c.status || '').toLowerCase() === statusFilter.toLowerCase())
    }

    // 3. Min spend filter
    if (minSpendFilter > 0) {
      list = list.filter((c) => (c.totalSpent || 0) >= minSpendFilter)
    }

    // 4. Search query
    if (contactSearchQuery.trim()) {
      const q = contactSearchQuery.toLowerCase().trim()
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.meta && c.meta.toLowerCase().includes(q)) ||
        (c.company && c.company.toLowerCase().includes(q))
      )
    }

    // 5. Sorting
    list.sort((a, b) => {
      if (sortBy === 'spend_desc') {
        const diff = (b.totalSpent || 0) - (a.totalSpent || 0)
        if (diff !== 0) return diff
        return (b.ordersCount || 0) - (a.ordersCount || 0)
      }
      if (sortBy === 'recent') {
        const timeA = a.date ? new Date(a.date).getTime() : 0
        const timeB = b.date ? new Date(b.date).getTime() : 0
        return timeB - timeA
      }
      if (sortBy === 'orders_desc') {
        const diff = (b.ordersCount || 0) - (a.ordersCount || 0)
        if (diff !== 0) return diff
        return (b.totalSpent || 0) - (a.totalSpent || 0)
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name)
      }
      return 0
    })

    return list
  }, [activeContactsList, filterSegment, statusFilter, minSpendFilter, contactSearchQuery, sortBy])

  // Aggregate stats
  const totalSpendInView = useMemo(() => {
    return filteredAndSortedContacts.reduce((acc, c) => acc + (c.totalSpent || 0), 0)
  }, [filteredAndSortedContacts])

  const filteredSelectedCount = useMemo(() => {
    return filteredAndSortedContacts.filter((c) => selectedPhones.has(c.phone)).length
  }, [filteredAndSortedContacts, selectedPhones])

  const isFilterActive =
    filterSegment !== 'all' ||
    statusFilter !== 'all' ||
    minSpendFilter > 0 ||
    contactSearchQuery.trim() !== ''

  const resetFilters = () => {
    setFilterSegment('all')
    setStatusFilter('all')
    setMinSpendFilter(0)
    setContactSearchQuery('')
    setSortBy('spend_desc')
  }

  // Toggle individual contact selection
  const toggleContact = (phone: string) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev)
      if (next.has(phone)) {
        next.delete(phone)
      } else {
        next.add(phone)
      }
      return next
    })
  }

  // Select all visible contacts in current view
  const selectAllFiltered = () => {
    setSelectedPhones((prev) => {
      const next = new Set(prev)
      filteredAndSortedContacts.forEach((c) => next.add(c.phone))
      return next
    })
  }

  // Deselect currently filtered contacts
  const deselectAllFiltered = () => {
    setSelectedPhones((prev) => {
      const next = new Set(prev)
      filteredAndSortedContacts.forEach((c) => next.delete(c.phone))
      return next
    })
  }

  // Quick select high-value VIPs (₹1k+)
  const selectHighValueOnly = () => {
    setSelectedPhones((prev) => {
      const next = new Set(prev)
      activeContactsList
        .filter((c) => (c.totalSpent || 0) >= 1000)
        .forEach((c) => next.add(c.phone))
      return next
    })
  }

  // Deselect all
  const deselectAllVisible = () => {
    setSelectedPhones(new Set())
  }

  // Selected count strictly within active segment
  const activeSelectedCount = useMemo(() => {
    return activeContactsList.filter((c) => selectedPhones.has(c.phone)).length
  }, [activeContactsList, selectedPhones])

  const handleSelectPreset = (preset: typeof PRESET_CAMPAIGNS[0]) => {
    setActivePreset(preset.id)
    setCampaignTitle(preset.title)
    setMessageText(preset.message)
    setMediaUrl(preset.mediaUrl)
    setUploadedImageSize(null)
    setLinkUrl(preset.linkUrl)
    setButtonText(preset.buttonText)
  }

  // Insert variable tag into message at cursor
  const insertTag = (tag: string) => {
    if (!textareaRef.current) {
      setMessageText((prev) => `${prev} ${tag}`)
      return
    }
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const nextText = messageText.substring(0, start) + tag + messageText.substring(end)
    setMessageText(nextText)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(start + tag.length, start + tag.length)
      }
    }, 0)
  }

  // Load previously uploaded banners from Supabase storage
  const fetchLibraryFiles = async () => {
    setLoadingLibrary(true)
    try {
      const res = await fetch('/api/admin/whatsapp/upload')
      const data = await res.json()
      if (res.ok && data.files) {
        setLibraryFiles(data.files)
      }
    } catch (err) {
      console.error('Failed to load media library:', err)
    } finally {
      setLoadingLibrary(false)
    }
  }

  useEffect(() => {
    fetchLibraryFiles()
  }, [])

  // Detect image aspect ratio whenever mediaUrl changes
  useEffect(() => {
    if (!mediaUrl) {
      setImageAspectRatio('landscape')
      return
    }
    const img = new Image()
    img.src = mediaUrl
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (w && h) {
        const ratio = w / h
        if (ratio >= 0.95 && ratio <= 1.05) {
          setImageAspectRatio('square')
        } else if (ratio < 0.95) {
          setImageAspectRatio('portrait')
        } else {
          setImageAspectRatio('landscape')
        }
      }
    }
  }, [mediaUrl])

  // Select banner from Supabase library
  const handleSelectLibraryItem = (file: UploadedMediaItem) => {
    setMediaUrl(file.url)
    setUploadedImageSize(file.sizeKb || null)
    setActivePreset('custom')
  }

  // Delete banner permanently from Supabase storage
  const handleDeleteUploadedFile = async (file: UploadedMediaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const confirmed = window.confirm(
      `Delete banner permanently?\n\nThis will remove "${file.name}" from Supabase storage.`
    )
    if (!confirmed) return

    setDeletingPath(file.path)
    try {
      const res = await fetch(`/api/admin/whatsapp/upload?path=${encodeURIComponent(file.path)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setLibraryFiles((prev) => prev.filter((f) => f.path !== file.path))
        if (mediaUrl === file.url) {
          setMediaUrl('')
          setUploadedImageSize(null)
          setImageAspectRatio('landscape')
        }
      } else {
        alert(data.error || 'Failed to delete file from Supabase storage')
      }
    } catch (err: any) {
      alert(err.message || 'Delete exception')
    } finally {
      setDeletingPath(null)
    }
  }

  // Handle image upload from local file
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/whatsapp/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.url) {
        setMediaUrl(data.url)
        if (data.sizeKb) {
          setUploadedImageSize(data.sizeKb)
        }
        if (data.shape) {
          setImageAspectRatio(data.shape)
        }
        setActivePreset('custom')
        fetchLibraryFiles() // refresh list with newly uploaded banner
      } else {
        alert(data.error || 'Failed to upload image')
      }
    } catch (err: any) {
      alert(err.message || 'Image upload exception')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Send single test to personal number
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testPhone.trim()) return
    setTestSending(true)
    setTestStatus(null)

    try {
      const res = await fetch('/api/admin/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: testPhone.trim(),
          customText: messageText.replace(/{name}/gi, 'Test Recipient'),
          mediaUrl: mediaUrl.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          buttonText: buttonText.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestStatus({ success: true })
      } else {
        setTestStatus({ success: false, error: data.error || 'Test dispatch rejected' })
      }
    } catch (err: any) {
      setTestStatus({ success: false, error: err.message || 'Network exception' })
    } finally {
      setTestSending(false)
    }
  }

  // Launch the live broadcast
  const handleLaunchBroadcast = async () => {
    if (activeSelectedCount === 0) return
    const confirmed = window.confirm(
      `Confirm WhatsApp Broadcast:\n\nDeploy this campaign to ${activeSelectedCount} selected recipients via Meta Cloud API?`
    )
    if (!confirmed) return

    setBroadcasting(true)
    setBroadcastError(null)
    setBroadcastResult(null)

    try {
      const selectedPhonesArray = Array.from(selectedPhones)

      const res = await fetch('/api/admin/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAudience,
          selectedPhones: selectedPhonesArray,
          customNumbers: parsedCustomContacts.map((c) => c.phone),
          campaignTitle,
          messageText,
          mediaUrl: mediaUrl.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          buttonText: buttonText.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setBroadcastError(data.error || 'Failed to dispatch broadcast campaign')
      } else {
        setBroadcastResult(data)
      }
    } catch (err: any) {
      setBroadcastError(err.message || 'Network exception during broadcast')
    } finally {
      setBroadcasting(false)
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-[1440px] mx-auto space-y-8 font-sans antialiased text-[#1d1d1f]">
      {/* ── HEADER & META STATUS BAR ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-200/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              WhatsApp Broadcast Studio
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Meta Cloud API v21.0 Active
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 font-normal max-w-2xl">
            Design and deploy verified corporate announcements, product catalog releases, and client loyalty broadcasts with media attachments and direct links.
          </p>
        </div>

        {/* Status Metrics Pill */}
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Addressable Pipeline</p>
          <p className="text-sm font-bold text-slate-900 font-mono">{counts.totalUniqueContacts} Contacts</p>
        </div>
      </div>

      {/* ── BROADCAST OUTCOME REPORT (IF LAUNCHED) ── */}
      {broadcastResult && (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 space-y-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                <Check size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Broadcast Completed</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Delivered to <strong>{broadcastResult.sentCount}</strong> recipients out of {broadcastResult.totalRecipients}.
                  {broadcastResult.failedCount > 0 && ` (${broadcastResult.failedCount} failed).`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setBroadcastResult(null)}
              className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-medium text-slate-800 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-white rounded-xl border border-slate-200">
            {broadcastResult.results.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg text-xs bg-slate-50 border border-slate-100">
                <span className="font-medium text-slate-900">{r.name} <span className="font-mono text-slate-500 text-[11px]">({r.phone})</span></span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  r.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {r.status === 'sent' ? 'Delivered' : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {broadcastError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
          <AlertTriangle size={18} className="shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-bold">Campaign Dispatch Alert</p>
            <p className="mt-0.5 leading-relaxed">{broadcastError}</p>
          </div>
        </div>
      )}

      {/* ── STUDIO LAYOUT: BUILDER (LEFT) vs SCROLLABLE IPHONE (RIGHT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: CAMPAIGN CONFIGURATION (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Audience Selector & Contact Inspector */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 block">Section 01</span>
                <h2 className="text-sm font-bold text-slate-900">Target Recipient Segment &amp; Contact Selection</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                <Users size={13} /> {activeSelectedCount} of {activeContactsList.length} Selected
              </span>
            </div>

            {/* Segment Tab Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <button
                type="button"
                onClick={() => setTargetAudience('all')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  targetAudience === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 font-medium hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-bold font-mono">{counts.totalUniqueContacts}</span>
                <span className="text-[11px] block mt-0.5 opacity-80">All Contacts</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetAudience('registered_customers')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  targetAudience === 'registered_customers'
                    ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 font-medium hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-bold font-mono">{counts.registeredCustomersCount || 0}</span>
                <span className="text-[11px] block mt-0.5 opacity-80">Registered Users</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetAudience('retail_customers')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  targetAudience === 'retail_customers'
                    ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 font-medium hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-bold font-mono">{counts.retailCustomersCount}</span>
                <span className="text-[11px] block mt-0.5 opacity-80">Retail Orders</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetAudience('leads')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  targetAudience === 'leads'
                    ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 font-medium hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-bold font-mono">{counts.leadsCount}</span>
                <span className="text-[11px] block mt-0.5 opacity-80">Corporate Leads</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetAudience('custom')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  targetAudience === 'custom'
                    ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 font-medium hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-bold font-mono">{parsedCustomContacts.length}</span>
                <span className="text-[11px] block mt-0.5 opacity-80">Manual List</span>
              </button>
            </div>

            {targetAudience === 'custom' && (
              <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Manual Phone Numbers Input</span>
                  <span className="text-[11px] font-mono font-semibold text-slate-600">
                    {parsedCustomContacts.length} Valid Numbers
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={customNumbersInput}
                  onChange={(e) => setCustomNumbersInput(e.target.value)}
                  placeholder="Paste numbers separated by commas or lines (e.g. 9999926273, 9876543210)..."
                  className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900 transition-colors"
                />
              </div>
            )}

            {/* ── CUSTOMER INTELLIGENCE & FILTER COMMAND CENTER ── */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              
              {/* 1. Quick Smart Segment Pills */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <SlidersHorizontal size={11} className="text-slate-500" />
                    Audience Segment Filters
                  </span>
                  {isFilterActive && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={10} /> Reset Filters
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterSegment('all')}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterSegment === 'all'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>All Contacts</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                      filterSegment === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {segmentCounts.all}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterSegment('high_value')}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterSegment === 'high_value'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <BadgePercent size={12} className={filterSegment === 'high_value' ? 'text-emerald-300' : 'text-emerald-600'} />
                    <span>High Value (INR 1k+)</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                      filterSegment === 'high_value' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800'
                    }`}>
                      {segmentCounts.high_value}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterSegment('custom_print')}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterSegment === 'custom_print'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Shirt size={12} className={filterSegment === 'custom_print' ? 'text-amber-300' : 'text-amber-600'} />
                    <span>Custom Print / Apparel</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                      filterSegment === 'custom_print' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {segmentCounts.custom_print}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterSegment('repeat')}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterSegment === 'repeat'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <ShoppingBag size={12} className={filterSegment === 'repeat' ? 'text-indigo-300' : 'text-indigo-600'} />
                    <span>Repeat Clients (2+)</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                      filterSegment === 'repeat' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-800'
                    }`}>
                      {segmentCounts.repeat}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterSegment('qualified')}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterSegment === 'qualified'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Briefcase size={12} className={filterSegment === 'qualified' ? 'text-purple-300' : 'text-purple-600'} />
                    <span>Qualified Leads</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                      filterSegment === 'qualified' ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-800'
                    }`}>
                      {segmentCounts.qualified}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterSegment('recent_30d')}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterSegment === 'recent_30d'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Calendar size={12} className={filterSegment === 'recent_30d' ? 'text-blue-300' : 'text-blue-600'} />
                    <span>Active (Last 30 Days)</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                      filterSegment === 'recent_30d' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-800'
                    }`}>
                      {segmentCounts.recent_30d}
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. Granular Controls: Search + Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                {/* Search input (5 cols) */}
                <div className="sm:col-span-5 relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    placeholder="Search by name, phone, company..."
                    className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
                  />
                  {contactSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setContactSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Status Dropdown (3 cols) */}
                <div className="sm:col-span-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full py-2 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-slate-900 transition-colors cursor-pointer"
                  >
                    <option value="all">Status: All</option>
                    <option value="paid">Status: Paid</option>
                    <option value="delivered">Status: Delivered</option>
                    <option value="shipped">Status: Shipped</option>
                    <option value="qualified">Status: Qualified</option>
                    <option value="new">Status: New</option>
                  </select>
                </div>

                {/* Spend Filter (2 cols) */}
                <div className="sm:col-span-2">
                  <select
                    value={minSpendFilter}
                    onChange={(e) => setMinSpendFilter(Number(e.target.value))}
                    className="w-full py-2 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-slate-900 transition-colors cursor-pointer"
                  >
                    <option value={0}>Spend: Any</option>
                    <option value={500}>INR 500+</option>
                    <option value={1000}>INR 1k+ (VIP)</option>
                    <option value={2500}>INR 2.5k+</option>
                    <option value={5000}>INR 5k+</option>
                  </select>
                </div>

                {/* Sort By Dropdown (2 cols) */}
                <div className="sm:col-span-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full py-2 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-slate-900 transition-colors cursor-pointer"
                  >
                    <option value="spend_desc">Sort: Spend</option>
                    <option value="recent">Sort: Recent</option>
                    <option value="orders_desc">Sort: Orders</option>
                    <option value="name_asc">Sort: Name A-Z</option>
                  </select>
                </div>
              </div>

              {/* 3. Batch Action Bar & Metrics */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-700">
                    Showing <strong>{filteredAndSortedContacts.length}</strong> of {activeContactsList.length}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    <strong>{filteredSelectedCount}</strong> checked
                  </span>
                  {totalSpendInView > 0 && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                        INR {totalSpendInView.toLocaleString('en-IN')} Total Spend
                      </span>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Select Filtered ({filteredAndSortedContacts.length})
                  </button>
                  <button
                    type="button"
                    onClick={selectHighValueOnly}
                    className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-md transition-colors cursor-pointer"
                  >
                    Select VIPs Only
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Deselect Filtered
                  </button>
                </div>
              </div>

              {/* 4. Scrollable Rich Customer Directory */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto divide-y divide-slate-100 shadow-2xs">
                {filteredAndSortedContacts.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-xs text-slate-500 font-medium">
                      No contacts match your current filter criteria.
                    </p>
                    {isFilterActive && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="px-3 py-1 rounded-md text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RotateCcw size={12} /> Reset Filter Criteria
                      </button>
                    )}
                  </div>
                ) : (
                  filteredAndSortedContacts.map((contact) => {
                    const isChecked = selectedPhones.has(contact.phone)
                    const initials = (contact.name || 'CU')
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()

                    const formattedDate = contact.date
                      ? new Date(contact.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : null

                    const statusColor = (() => {
                      const s = (contact.status || '').toLowerCase()
                      if (s === 'paid' || s === 'delivered') return 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                      if (s === 'shipped' || s === 'processing') return 'bg-blue-50 text-blue-800 border-blue-200/80'
                      if (s === 'qualified' || s === 'in_progress') return 'bg-purple-50 text-purple-800 border-purple-200/80'
                      if (s === 'new') return 'bg-amber-50 text-amber-800 border-amber-200/80'
                      return 'bg-slate-100 text-slate-700 border-slate-200'
                    })()

                    return (
                      <div
                        key={`${contact.source}-${contact.id}-${contact.phone}`}
                        onClick={() => toggleContact(contact.phone)}
                        className={`p-3 px-3.5 flex items-center justify-between gap-3 text-xs transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-slate-50/90 hover:bg-slate-100/80'
                            : 'hover:bg-slate-50/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Checkbox */}
                          <div className="shrink-0 text-slate-900">
                            {isChecked ? (
                              <CheckSquare size={16} className="text-slate-900" />
                            ) : (
                              <Square size={16} className="text-slate-300" />
                            )}
                          </div>

                          {/* Avatar with Initials */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 font-mono ${
                            contact.source === 'customer'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                              : contact.source === 'retail'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200/80'
                              : contact.source === 'lead'
                              ? 'bg-purple-50 text-purple-800 border border-purple-200/80'
                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}>
                            {initials}
                          </div>

                          {/* Contact Details */}
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 truncate">{contact.name}</span>
                              <span className="text-[11px] font-mono text-slate-400 font-normal">
                                +{contact.phone}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-500 truncate flex-wrap">
                              {contact.company && (
                                <span className="flex items-center gap-1 text-slate-700 font-medium">
                                  <Building2 size={11} className="text-slate-400" />
                                  {contact.company}
                                </span>
                              )}
                              {contact.meta && !contact.company && (
                                <span>{contact.meta}</span>
                              )}
                              {formattedDate && (
                                <span className="text-slate-400 font-mono text-[10px]">
                                  {formattedDate}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Customer Tags & Badges */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {/* Total Spend Badge */}
                          {typeof contact.totalSpent === 'number' && contact.totalSpent > 0 && (
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                              INR {contact.totalSpent.toLocaleString('en-IN')}
                            </span>
                          )}

                          {/* Custom Print Badge */}
                          {contact.hasCustomPrint && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1">
                              <Shirt size={10} className="text-amber-600" />
                              Custom Print
                            </span>
                          )}

                          {/* Repeat Orders Badge */}
                          {contact.ordersCount && contact.ordersCount > 1 ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200/80">
                              {contact.ordersCount} Orders
                            </span>
                          ) : null}

                          {/* Status Badge */}
                          {contact.status && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border capitalize ${statusColor}`}>
                              {contact.status}
                            </span>
                          )}

                          {/* Source Tag */}
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                              contact.source === 'customer'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : contact.source === 'retail'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : contact.source === 'lead'
                                ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {contact.source === 'customer' ? 'Registered User' : contact.source === 'retail' ? 'Retail' : contact.source === 'lead' ? 'Corporate' : 'Manual'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>
                  Click any contact to toggle. Broadcast strictly targets checked recipients.
                </span>
                <span className="font-semibold text-slate-700">
                  Targeting {activeSelectedCount} of {activeContactsList.length} Contacts
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Campaign Content & Presets */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 block">Section 02</span>
              <h2 className="text-sm font-bold text-slate-900">Message Content &amp; Copywriting</h2>
            </div>

            {/* Campaign Preset Cards */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Standard Campaign Templates
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {PRESET_CAMPAIGNS.map((preset) => {
                  const isSelected = activePreset === preset.id
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {preset.category}
                          </span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center">
                              <Check size={10} />
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-xs text-slate-900 leading-snug">{preset.title}</h4>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Internal Campaign Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Internal Campaign Reference</label>
              <input
                type="text"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>

            {/* WhatsApp Message Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Message Body Copy
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">Variable Tag:</span>
                  <button
                    type="button"
                    onClick={() => insertTag('{name}')}
                    className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
                  >
                    + &#123;name&#125;
                  </button>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                rows={7}
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value)
                  setActivePreset('custom')
                }}
                className="w-full text-xs font-sans p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900 leading-relaxed transition-colors"
                placeholder="Enter your message copy here..."
              />
            </div>
          </div>

          {/* Section 3: Media Attachment & Clickable Landing Link */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 block">Section 03</span>
              <h2 className="text-sm font-bold text-slate-900">Media Banner &amp; Direct Destination Link</h2>
            </div>

            {/* Image Banner Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon size={15} className="text-slate-500" />
                  Header Media Banner
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLibraryPanel((prev) => !prev)}
                    className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <FolderOpen size={12} className="text-slate-500" />
                    {showLibraryPanel ? 'Hide Library' : `Saved Banners (${libraryFiles.length})`}
                  </button>
                  {mediaUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setMediaUrl('')
                        setUploadedImageSize(null)
                        setImageAspectRatio('landscape')
                        setActivePreset('custom')
                      }}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <X size={12} /> Remove Media
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => {
                    setMediaUrl(e.target.value)
                    setUploadedImageSize(null)
                    setActivePreset('custom')
                  }}
                  placeholder="Paste direct HTTPS image URL..."
                  className="flex-1 text-xs font-mono p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900"
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileUpload}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Optimizing &amp; Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Upload Banner</span>
                    </>
                  )}
                </button>
              </div>

              {/* WebP & Supabase Storage Verification Note + Shape Indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                  Auto-converted to WebP strictly under 30KB &bull; Stored permanently in Supabase CDN
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {mediaUrl && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                      <Maximize2 size={10} className="text-slate-500" />
                      {imageAspectRatio === 'square'
                        ? 'Square (1:1 Proportions)'
                        : imageAspectRatio === 'portrait'
                        ? 'Portrait Rectangle (Tall)'
                        : 'Landscape Rectangle (Wide)'}
                    </span>
                  )}
                  {uploadedImageSize && (
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Optimized: {uploadedImageSize}
                    </span>
                  )}
                </div>
              </div>

              {/* Aspect Ratio Framing Mode Selector */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-800 text-[11px]">Preview Aspect Ratio Mode</p>
                  <p className="text-[10px] text-slate-500">
                    WhatsApp delivers images with natural proportions. Any shape (Square 1:1, Landscape 16:9, Portrait 4:5) is preserved.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewFit('natural')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                      previewFit === 'natural'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Natural Proportions (Any Size)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFit('cover')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                      previewFit === 'cover'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cover Crop
                  </button>
                </div>
              </div>

              {/* ── SAVED SUPABASE MEDIA LIBRARY (RE-USE & DELETE) ── */}
              {showLibraryPanel && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <FolderOpen size={13} className="text-slate-600" />
                        Saved Supabase Banners ({libraryFiles.length})
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Click any previously uploaded banner to re-use it instantly, or delete unused assets.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={fetchLibraryFiles}
                      disabled={loadingLibrary}
                      className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={11} className={loadingLibrary ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>

                  {loadingLibrary && libraryFiles.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Loading saved Supabase assets...
                    </div>
                  ) : libraryFiles.length === 0 ? (
                    <div className="p-4 text-center rounded-lg bg-white border border-dashed border-slate-200 text-xs text-slate-400">
                      No banners uploaded to Supabase yet. Upload one above to populate your library.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                      {libraryFiles.map((file) => {
                        const isSelected = mediaUrl === file.url
                        const isDeleting = deletingPath === file.path

                        return (
                          <div
                            key={file.id || file.path}
                            onClick={() => handleSelectLibraryItem(file)}
                            className={`group relative rounded-xl border overflow-hidden bg-white cursor-pointer transition-all ${
                              isSelected
                                ? 'border-slate-900 ring-2 ring-slate-900 shadow-xs'
                                : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                            }`}
                          >
                            {/* Thumbnail Container */}
                            <div className="aspect-video w-full bg-slate-100 overflow-hidden relative flex items-center justify-center">
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none'
                                }}
                              />

                              {/* Active Badge */}
                              {isSelected && (
                                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-slate-900 text-white text-[9px] font-bold shadow-xs flex items-center gap-1">
                                  <Check size={9} /> Selected
                                </span>
                              )}

                              {/* Delete Action Button */}
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={(e) => handleDeleteUploadedFile(file, e)}
                                title="Delete from Supabase storage permanently"
                                className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-white/95 text-rose-600 hover:bg-rose-600 hover:text-white shadow-xs opacity-80 group-hover:opacity-100 transition-all cursor-pointer"
                              >
                                {isDeleting ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Trash2 size={11} />
                                )}
                              </button>
                            </div>

                            {/* Info footer */}
                            <div className="p-2 flex items-center justify-between text-[10px]">
                              <span className="font-mono text-slate-500 font-semibold truncate max-w-[80px]">
                                {file.sizeKb || 'WebP'}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                                {isSelected ? 'In Use' : 'Use Banner'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sample Quick Photo Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">Sample Assets:</span>
                {SAMPLE_IMAGES.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMediaUrl(img.url)
                      setUploadedImageSize(null)
                      setActivePreset('custom')
                    }}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      mediaUrl === img.url
                        ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {img.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Clickable Action Link & Button Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <LinkIcon size={15} className="text-slate-500" />
                  Interactive Call-To-Action Link
                </label>
                {linkUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setLinkUrl('')
                      setButtonText('')
                      setActivePreset('custom')
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    <X size={12} /> Remove Link
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Destination URL</label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => {
                      setLinkUrl(e.target.value)
                      setActivePreset('custom')
                    }}
                    placeholder="https://outflank.in/products"
                    className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Button Label</label>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={(e) => {
                      setButtonText(e.target.value)
                      setActivePreset('custom')
                    }}
                    placeholder="e.g. View Corporate Catalog"
                    className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Quick Preset Links */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">Quick Links:</span>
                {PRESET_LINKS.map((pl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setLinkUrl(pl.url)
                      setButtonText(pl.buttonText)
                      setActivePreset('custom')
                    }}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      linkUrl === pl.url
                        ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Live Personal Test Flight */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3">
            <div>
              <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Phone size={14} className="text-slate-600" />
                Single-Recipient Verification Flight
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Dispatch an immediate test payload to your personal mobile device to verify image resolution and URL resolution on WhatsApp.
              </p>
            </div>

            <form onSubmit={handleSendTest} className="flex items-center gap-2.5">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Enter 10-digit mobile number (e.g. 9999926273)"
                className="flex-1 text-xs font-mono p-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-slate-900"
              />
              <button
                type="submit"
                disabled={testSending || !testPhone.trim()}
                className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-xs"
              >
                {testSending ? <Loader2 size={14} className="animate-spin" /> : 'Send Test'}
              </button>
            </form>

            {testStatus && (
              <p className={`text-xs font-semibold ${testStatus.success ? 'text-emerald-700' : 'text-rose-600'}`}>
                {testStatus.success ? 'Test payload verified and dispatched successfully.' : `Error: ${testStatus.error}`}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SCROLLABLE IPHONE 16 PRO MOCKUP (5 cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Eye size={14} /> WhatsApp Business Mobile Preview
            </h3>
            <span className="text-[11px] font-medium text-slate-400">
              Scrollable Viewport
            </span>
          </div>

          {/* iPhone 16 Pro Titanium Chassis */}
          <div className="w-full max-w-[370px] mx-auto bg-[#18181b] rounded-[3rem] p-3 shadow-2xl ring-1 ring-white/10 border-2 border-[#27272a]">
            {/* Screen Glass */}
            <div className="bg-[#efeae2] rounded-[2.5rem] overflow-hidden flex flex-col h-[600px] relative shadow-inner">
              {/* Dynamic Island Pill & iOS Status Bar */}
              <div className="bg-[#075E54] pt-2 pb-1 px-6 flex items-center justify-between text-white shrink-0">
                <span className="text-[11px] font-semibold tracking-tight">{currentTime}</span>
                {/* Dynamic Island */}
                <div className="w-20 h-4 bg-black rounded-full mx-auto" />
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  <span>5G</span>
                  <span className="w-4 h-2.5 border border-white rounded-xs p-0.5 inline-block">
                    <span className="w-full h-full bg-white block rounded-2xs" />
                  </span>
                </div>
              </div>

              {/* WhatsApp iOS Header */}
              <div className="bg-[#075E54] text-white px-3 py-2.5 flex items-center justify-between shadow-xs shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronLeft size={20} className="shrink-0 -ml-1 text-emerald-100" />
                  <div className="w-8 h-8 rounded-full bg-white text-[#075E54] flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                    OF
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-xs truncate">Outflank</p>
                      <ShieldCheck size={13} className="text-emerald-300 shrink-0" />
                    </div>
                    <p className="text-[9px] text-emerald-100/90 truncate">Official Business Account</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-emerald-100 shrink-0">
                  <Video size={16} />
                  <PhoneCall size={15} />
                  <MoreVertical size={16} />
                </div>
              </div>

              {/* ── SCROLLABLE CHAT CONTENT ── */}
              <div
                ref={phoneChatRef}
                className="flex-1 p-3 overflow-y-auto space-y-3 overscroll-contain"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#075E54 transparent',
                }}
              >
                {/* Date Marker */}
                <div className="text-center sticky top-0 z-10 py-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[9px] font-semibold text-slate-500 shadow-xs uppercase tracking-wider">
                    Today
                  </span>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="w-full max-w-[95%] bg-white rounded-2xl rounded-tl-xs shadow-xs border border-slate-200/60 overflow-hidden space-y-0">
                  {/* Image Banner with Natural Aspect Ratio Support (Square, Rectangle, etc.) */}
                  {mediaUrl && (
                    <div className="w-full bg-slate-100 overflow-hidden relative border-b border-slate-100 flex items-center justify-center">
                      <img
                        src={mediaUrl}
                        alt="Campaign Banner"
                        className={`w-full transition-all ${
                          previewFit === 'cover'
                            ? 'h-48 object-cover'
                            : 'h-auto max-h-[360px] object-contain block'
                        }`}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  {/* Caption & Message Body */}
                  <div className="p-3.5 space-y-2">
                    <p className="text-[12px] text-slate-900 whitespace-pre-line leading-relaxed font-sans select-text">
                      {messageText.replace(/{name}/gi, 'Client')}
                    </p>

                    {/* Timestamp & double ticks */}
                    <div className="flex items-center justify-end gap-1 text-[9.5px] text-slate-400 font-medium pt-1">
                      <span>{currentTime}</span>
                      <CheckCheck size={13} className="text-[#34B7F1]" />
                    </div>
                  </div>

                  {/* WhatsApp Official CTA Button (Clickable!) */}
                  {linkUrl && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-[#075E54] hover:bg-emerald-50 text-xs font-semibold transition-colors text-center group"
                      >
                        <ExternalLink size={12} className="shrink-0 text-[#075E54] group-hover:scale-105 transition-transform" />
                        <span className="truncate">{buttonText || 'Visit Outflank'}</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Scroll Indicator */}
                <div className="text-center py-2">
                  <span className="text-[9px] font-medium text-slate-400 bg-black/5 px-2 py-0.5 rounded-full">
                    Scroll viewport to review complete content
                  </span>
                </div>
              </div>

              {/* Simulated iOS WhatsApp Keyboard Bar */}
              <div className="bg-[#f0f2f5] px-3 py-2 flex items-center gap-2 shrink-0 border-t border-slate-200">
                <Smile size={18} className="text-slate-400 shrink-0" />
                <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Message</span>
                  <Paperclip size={14} className="text-slate-400" />
                </div>
                <div className="w-7 h-7 rounded-full bg-[#075E54] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Mic size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* Launch Campaign Broadcast CTA Button */}
          <div className="pt-2 max-w-[370px] mx-auto">
            <button
              type="button"
              disabled={broadcasting || activeSelectedCount === 0}
              onClick={handleLaunchBroadcast}
              className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-40 text-white font-semibold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {broadcasting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Dispatching Campaign via Meta API...</span>
                </>
              ) : (
                <>
                  <Megaphone size={15} />
                  <span>Deploy Broadcast ({activeSelectedCount} Selected Contacts)</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-2 font-normal">
              Official Meta Cloud API v21.0 compliance. Messages queued and rate-limited automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
