'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@supabase/supabase-js'
import {
  Search, CheckCheck, Check, MessageSquare, Send, Smile,
  Paperclip, MoreVertical, ArrowLeft,
  RefreshCw, X, ShieldCheck, Inbox, Plus, Edit3,
  UserPlus, CheckCircle2, Clock, XCircle, ImageIcon,
  FileText, Film
} from 'lucide-react'

// Lazy-load the emoji picker so it doesn't bloat the initial bundle
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

// ── Types ───────────────────────────────────────────────────────────────────
interface Conversation {
  id: string
  contact_phone: string
  contact_name: string
  last_message: string | null
  last_message_at: string
  unread_count: number
  status: string
  assigned_to: string | null
  created_at: string
}

interface Message {
  id: string
  conversation_id: string
  wamid: string | null
  direction: 'inbound' | 'outbound'
  message_type: string
  body: string | null
  media_url: string | null
  status: string
  sent_by: string | null
  timestamp: string
}

interface InboxClientProps {
  initialConversations: Conversation[]
}

// ── Supabase browser client ──────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' })
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function formatDateLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-green-600',
]

function getAvatarColor(phone: string) {
  const idx = parseInt(phone.slice(-2), 10) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[idx]
}

function StatusTick({ status }: { status: string }) {
  if (status === 'read')      return <CheckCheck size={14} className="text-[#34B7F1] shrink-0" />
  if (status === 'delivered') return <CheckCheck size={14} className="text-slate-400 shrink-0" />
  if (status === 'sent')      return <Check size={14} className="text-slate-400 shrink-0" />
  if (status === 'sending')   return <Clock size={12} className="text-slate-300 shrink-0 animate-pulse" />
  if (status === 'failed')    return <XCircle size={14} className="text-rose-500 shrink-0" />
  return null
}

// ── New Conversation Modal ───────────────────────────────────────────────────
function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (conv: Conversation) => void
}) {
  const [phone, setPhone] = useState('')
  const [name, setName]   = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Clean phone number
    let cleanPhone = phone.replace(/[^0-9]/g, '')
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`
    if (cleanPhone.length < 10) {
      setError('Enter a valid 10-digit Indian mobile number (or include country code)')
      return
    }

    if (!message.trim()) {
      setError('Please enter a message to send')
      return
    }

    setLoading(true)
    try {
      const form = new FormData();
      form.append('to', cleanPhone);
      form.append('message', message.trim());
      form.append('messageType', 'text');

      const res = await fetch('/api/admin/whatsapp/reply', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to send message. Note: Customer must have messaged you first within 24hrs for free-form text.')
        setLoading(false)
        return
      }
      // Fetch the created conversation
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('contact_phone', cleanPhone)
        .single()

      if (conv) onCreated(conv)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#075e54]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <UserPlus size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">New Conversation</p>
              <p className="text-white/60 text-[11px]">Start a chat with any customer</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number *</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 9876543210 or 919876543210"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">10-digit number or with +91 prefix</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contact Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">First Message *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your message..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all resize-none"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
              <XCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-rose-600">{error}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-[11px] text-amber-700 font-medium">
              ⚠️ 24-hour window rule: Free-form messages can only be sent if the customer messaged you first within the last 24 hours. Otherwise, use the Broadcast page with an approved template.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#075e54] hover:bg-[#064e46] disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function InboxClient({ initialConversations }: InboxClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [activeConv, setActiveConv]       = useState<Conversation | null>(null)
  const [messages, setMessages]           = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [replyText, setReplyText]         = useState('')
  const [sending, setSending]             = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [filterStatus, setFilterStatus]  = useState<'all' | 'unread' | 'open' | 'resolved'>('all')
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [showNewModal, setShowNewModal]   = useState(false)
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [attachmentPreview, setAttachmentPreview] = useState<{
    file?: File; url: string; name: string; type: 'image' | 'document' | 'video'; mimeType: string; uploading: boolean
  } | null>(null)

  const chatEndRef    = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLTextAreaElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const emojiRef      = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false)
      }
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Handle file selection ──────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const isImage    = file.type.startsWith('image/')
    const isVideo    = file.type.startsWith('video/')
    const fileType   = isImage ? 'image' : isVideo ? 'video' : 'document'
    const localUrl   = URL.createObjectURL(file)

    setAttachmentPreview({ file, url: localUrl, name: file.name, type: fileType, mimeType: file.type, uploading: false })
  }

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (conv: Conversation) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/admin/whatsapp/messages?conversationId=${conv.id}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } finally {
      setLoadingMessages(false)
    }
    // Mark as read
    await fetch('/api/admin/whatsapp/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conv.id }),
    })
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
  }, [])

  const openConversation = useCallback((conv: Conversation) => {
    setActiveConv(conv)
    setMobileShowChat(true)
    loadMessages(conv)
  }, [loadMessages])

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    const convChannel = supabase
      .channel('wa_conversations_inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setConversations(prev => [payload.new as Conversation, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setConversations(prev =>
            prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } as Conversation : c)
              .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          )
          // Update active conv if it's the one being updated
          setActiveConv(prev => prev?.id === payload.new.id ? { ...prev, ...payload.new } as Conversation : prev)
        }
      })
      .subscribe()

    const msgChannel = supabase
      .channel('wa_messages_inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => {
          if (!activeConv || newMsg.conversation_id !== activeConv.id) return prev
          // Already exists by real ID
          if (prev.find(m => m.id === newMsg.id)) return prev
          // Replace optimistic outbound message that matches by wamid
          if (newMsg.direction === 'outbound' && newMsg.wamid) {
            const hasOptimistic = prev.find(m => m.wamid === newMsg.wamid && m.id.startsWith('optimistic-'))
            if (hasOptimistic) {
              return prev.map(m => m.id === hasOptimistic.id ? newMsg : m)
            }
          }
          return [...prev, newMsg]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } as Message : m))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(convChannel)
      supabase.removeChannel(msgChannel)
    }
  }, [activeConv])

  // ── Send reply (text + optional media) ─────────────────────────────────────
  const sendReply = async () => {
    const hasText  = replyText.trim().length > 0
    const hasMedia = attachmentPreview && !attachmentPreview.uploading
    if ((!hasText && !hasMedia) || !activeConv || sending) return

    setSending(true)
    const text     = replyText.trim()
    const mediaUrl = hasMedia ? attachmentPreview!.url : undefined
    const msgType  = hasMedia ? attachmentPreview!.type : 'text'
    const msgBody  = hasText ? text : `[${msgType}]`

    setReplyText('')
    setAttachmentPreview(null)
    setShowEmojiPicker(false)

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeConv.id,
      wamid: null,
      direction: 'outbound',
      message_type: msgType,
      body: msgBody,
      media_url: mediaUrl || null,
      status: 'sending',
      sent_by: 'admin',
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const form = new FormData();
      form.append('conversationId', activeConv.id);
      form.append('to', activeConv.contact_phone);
      if (text) form.append('message', text);
      form.append('messageType', msgType);
      if (hasMedia && attachmentPreview?.file) {
        form.append('file', attachmentPreview.file);
      }

      const res = await fetch('/api/admin/whatsapp/reply', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...m, status: 'failed' } : m))
        alert(`Failed to send: ${data.error}`)
      } else {
        // Update optimistic message with real wamid so Realtime dedup works
        setMessages(prev => prev.map(m =>
          m.id === optimisticMsg.id ? { ...m, status: 'sent', wamid: data.wamid } : m
        ))
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...m, status: 'failed' } : m))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // ── Mark conversation status ───────────────────────────────────────────────
  const updateConvStatus = async (status: string) => {
    if (!activeConv) return
    setShowStatusMenu(false)
    await fetch(`/api/admin/whatsapp/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConv.id }),
    })
    // Optimistic update
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status } : c))
    setActiveConv(prev => prev ? { ...prev, status } : null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() }
  }

  // ── Filtered conversations ─────────────────────────────────────────────────
  const filteredConversations = conversations.filter(c => {
    const matchSearch = searchQuery
      ? c.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) || c.contact_phone.includes(searchQuery)
      : true
    const matchFilter =
      filterStatus === 'all'      ? true :
      filterStatus === 'unread'   ? c.unread_count > 0 :
      filterStatus === 'resolved' ? c.status === 'resolved' :
      c.status === 'open'
    return matchSearch && matchFilter
  })

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0)

  // ── Group messages by date ─────────────────────────────────────────────────
  const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const label = formatDateLabel(msg.timestamp)
    const last  = acc[acc.length - 1]
    if (!last || last.date !== label) acc.push({ date: label, msgs: [msg] })
    else last.msgs.push(msg)
    return acc
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onCreated={(conv) => {
            setConversations(prev => {
              if (prev.find(c => c.id === conv.id)) return prev
              return [conv, ...prev]
            })
            openConversation(conv)
          }}
        />
      )}

      <div className="flex h-full bg-[#f0f2f5] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* ══════════ LEFT: CONVERSATION LIST ══════════ */}
        <div
          className={`flex flex-col bg-white border-r border-slate-200 shrink-0 transition-all duration-300 overflow-hidden ${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          } ${sidebarOpen ? 'w-full md:w-[340px] lg:w-[360px]' : 'w-0 md:w-0 border-r-0'}`}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-[#f0f2f5] border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                OF
              </div>
              <div>
                <p className="font-bold text-sm text-slate-800 leading-tight">Outflank Inbox</p>
                <p className="text-[10px] text-slate-500">WhatsApp Business</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {totalUnread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold mr-1">
                  {totalUnread}
                </span>
              )}
              {/* New Conversation Button */}
              <button
                onClick={() => setShowNewModal(true)}
                title="Start new conversation"
                className="p-2 rounded-full hover:bg-white transition-colors text-slate-500 hover:text-[#075e54] group relative"
              >
                <Edit3 size={17} />
                <span className="absolute -bottom-7 right-0 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  New Chat
                </span>
              </button>
              <button className="p-2 rounded-full hover:bg-white transition-colors text-slate-500">
                <MoreVertical size={17} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2 bg-[#f0f2f5]">
            <div className="flex items-center gap-2 bg-white rounded-full px-3 py-2 border border-slate-200 shadow-sm">
              <Search size={13} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name or phone"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-slate-400 text-slate-700"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-100 overflow-x-auto">
            {(['all', 'unread', 'open', 'resolved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-all ${
                  filterStatus === f
                    ? 'bg-[#075e54] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'unread' && totalUnread > 0 && (
                  <span className="ml-1 opacity-80">({totalUnread})</span>
                )}
              </button>
            ))}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4 py-12">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <Inbox size={28} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-slate-600 text-sm font-semibold mb-1">No conversations yet</p>
                  <p className="text-slate-400 text-[12px] leading-relaxed max-w-[200px]">
                    When customers reply to your broadcasts, their messages will appear here.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#075e54] text-white text-[12px] font-semibold hover:bg-[#064e46] transition-colors shadow-sm"
                >
                  <Plus size={14} />
                  Start New Chat
                </button>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 hover:bg-[#f5f6f6] active:bg-[#ebebeb] transition-colors border-b border-slate-50 text-left ${
                    activeConv?.id === conv.id ? 'bg-[#ebebeb]' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(conv.contact_phone)} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm`}>
                    {getInitials(conv.contact_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-[13px] truncate ${conv.unread_count > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {conv.contact_name}
                      </p>
                      <span className={`text-[11px] shrink-0 ml-2 ${conv.unread_count > 0 ? 'text-[#075e54] font-semibold' : 'text-slate-400'}`}>
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[12px] truncate leading-tight ${conv.unread_count > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                        {conv.last_message || 'No messages yet'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {conv.status === 'resolved' && (
                          <span className="w-2 h-2 rounded-full bg-slate-300" title="Resolved" />
                        )}
                        {conv.unread_count > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[#25d366] text-white text-[10px] font-bold flex items-center justify-center">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* New Chat FAB at bottom */}
          <div className="p-3 border-t border-slate-100 bg-white">
            <button
              onClick={() => setShowNewModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#075e54] hover:bg-[#064e46] text-white text-[13px] font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} />
              Start New Conversation
            </button>
          </div>
        </div>

        {/* ══════════ CENTER: CHAT WINDOW ══════════ */}
        <div className={`flex-1 flex flex-col min-w-0 relative ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-[#f0f2f5] border-b border-slate-200 shrink-0">
                <button
                  className="md:hidden p-1 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
                  onClick={() => { setMobileShowChat(false); setActiveConv(null) }}
                >
                  <ArrowLeft size={20} />
                </button>

                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(activeConv.contact_phone)} text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0`}>
                  {getInitials(activeConv.contact_name)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13px] text-slate-900 truncate">{activeConv.contact_name}</p>
                  <p className="text-[11px] text-slate-500">+{activeConv.contact_phone}</p>
                </div>

                <div className="flex items-center gap-1 text-slate-500">
                  {/* Toggle sidebar button */}
                  <button
                    onClick={() => setSidebarOpen(v => !v)}
                    title={sidebarOpen ? 'Hide contacts' : 'Show contacts'}
                    className="p-2 hover:bg-white rounded-full transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M9 3v18"/>
                    </svg>
                  </button>

                  {/* Status dropdown */}
                  <div className="relative" ref={statusMenuRef}>
                    <button
                      onClick={() => setShowStatusMenu(v => !v)}
                      className="p-2 hover:bg-white rounded-full transition-colors flex items-center gap-1"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {showStatusMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-20 min-w-[160px]">
                        <button
                          onClick={() => updateConvStatus('resolved')}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        >
                          <CheckCircle2 size={15} className="text-emerald-500" />
                          Mark Resolved
                        </button>
                        <button
                          onClick={() => updateConvStatus('open')}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        >
                          <MessageSquare size={15} className="text-blue-500" />
                          Mark Open
                        </button>
                        <div className="border-t border-slate-100" />
                        <div className="px-4 py-2">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Status</p>
                          <p className="text-[12px] font-semibold mt-0.5 capitalize" style={{ color: activeConv.status === 'resolved' ? '#10b981' : '#3b82f6' }}>
                            {activeConv.status}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages area */}
              <div
                className="flex-1 overflow-y-auto px-4 py-4"
                style={{
                  background: 'linear-gradient(135deg, #dfe7ed 0%, #e8ecef 100%)',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Ctext x='0' y='150' font-size='200' opacity='0.015'%3E💬%3C/text%3E%3C/svg%3E"), linear-gradient(135deg, %23dfe7ed 0%25, %23e8ecef 100%25)`,
                }}
              >
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw size={24} className="text-[#075e54] animate-spin" />
                      <p className="text-slate-500 text-sm">Loading messages...</p>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-16 h-16 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-sm">
                      <MessageSquare size={28} className="text-slate-400" />
                    </div>
                    <p className="text-slate-600 text-sm font-semibold">No messages yet</p>
                    <p className="text-slate-500 text-[12px] text-center">Send a message to start this conversation.</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {groupedMessages.map(group => (
                      <div key={group.date}>
                        {/* Date label */}
                        <div className="flex justify-center my-4">
                          <span className="px-3 py-1 rounded-full bg-[#d1d7db]/80 text-[11px] font-semibold text-slate-600 shadow-sm">
                            {group.date}
                          </span>
                        </div>

                        {group.msgs.map(msg => (
                          <div
                            key={msg.id}
                            className={`flex mb-1.5 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[72%] rounded-2xl shadow-sm text-[13px] leading-relaxed overflow-hidden ${
                                msg.direction === 'outbound'
                                  ? 'bg-[#d9fdd3] rounded-tr-none text-slate-800'
                                  : 'bg-white rounded-tl-none text-slate-800'
                              } ${msg.status === 'failed' ? 'ring-1 ring-rose-300' : ''}`}
                            >
                              {/* ── Image ── */}
                              {msg.message_type === 'image' && msg.media_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={msg.media_url}
                                  alt="image"
                                  className="max-w-full max-h-60 w-auto object-cover block"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              )}
                              {/* ── Video ── */}
                              {msg.message_type === 'video' && msg.media_url && (
                                <video
                                  src={msg.media_url}
                                  controls
                                  className="max-w-full max-h-60 block"
                                />
                              )}
                              {/* ── Document ── */}
                              {msg.message_type === 'document' && msg.media_url && (
                                <a
                                  href={msg.media_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-black/5 transition-colors"
                                >
                                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                    <FileText size={18} className="text-blue-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-semibold truncate max-w-[160px]">{msg.body || 'Document'}</p>
                                    <p className="text-[10px] text-slate-500">Tap to open</p>
                                  </div>
                                </a>
                              )}
                              {/* ── Text / Caption ── */}
                              <div className="px-3 py-2">
                                {(msg.message_type === 'text' || !msg.media_url) && (
                                  <p className="whitespace-pre-wrap break-words">{msg.body || `[${msg.message_type}]`}</p>
                                )}
                                {msg.message_type !== 'text' && msg.media_url && msg.body && msg.body !== `[${msg.message_type}]` && (
                                  <p className="whitespace-pre-wrap break-words mt-1">{msg.body}</p>
                                )}
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                  <span className="text-[10px] text-slate-400">{formatTime(msg.timestamp)}</span>
                                  {msg.direction === 'outbound' && <StatusTick status={msg.status} />}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className="bg-[#f0f2f5] border-t border-slate-200 shrink-0">

                {/* Attachment preview */}
                {attachmentPreview && (
                  <div className="flex items-center gap-3 px-4 py-2 bg-white/80 border-b border-slate-100">
                    {attachmentPreview.type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attachmentPreview.url} alt="preview" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
                    ) : attachmentPreview.type === 'video' ? (
                      <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <Film size={22} className="text-slate-500" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                        <FileText size={22} className="text-blue-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-700 truncate">{attachmentPreview.name}</p>
                      <p className="text-[11px] text-slate-400 capitalize">{attachmentPreview.type}</p>
                      {attachmentPreview.uploading && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <RefreshCw size={11} className="animate-spin text-emerald-500" />
                          <span className="text-[10px] text-emerald-600">Uploading...</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setAttachmentPreview(null)}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Emoji picker — anchored relative to the input bar */}
                {showEmojiPicker && (
                  <div
                    ref={emojiRef}
                    className="absolute z-30 shadow-2xl rounded-2xl overflow-hidden"
                    style={{ bottom: '72px', left: '12px' }}
                  >
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        setReplyText(prev => prev + emojiData.emoji)
                        // Don't close picker so user can pick multiple
                      }}
                      height={380}
                      width={340}
                      searchDisabled={false}
                      skinTonesDisabled
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}

                <div className="px-3 py-2 flex items-end gap-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={handleFileChange}
                  />

                  {/* Emoji button */}
                  <button
                    onClick={() => setShowEmojiPicker(v => !v)}
                    className={`p-2.5 rounded-full transition-all shrink-0 ${
                      showEmojiPicker
                        ? 'bg-[#075e54] text-white'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                    }`}
                  >
                    <Smile size={22} />
                  </button>

                  {/* Attachment button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-full transition-all shrink-0"
                    title="Attach image or document"
                  >
                    <Paperclip size={22} />
                  </button>

                  {/* Text input */}
                  <div className="flex-1 bg-white rounded-2xl border border-slate-200 px-4 py-2.5 min-h-[44px] flex items-end shadow-sm">
                    <textarea
                      ref={inputRef}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={attachmentPreview ? 'Add a caption (optional)' : 'Type a message'}
                      rows={1}
                      className="flex-1 text-[13px] text-slate-800 bg-transparent outline-none resize-none placeholder:text-slate-400 max-h-32 overflow-y-auto"
                      style={{ lineHeight: '1.5' }}
                    />
                  </div>

                  {/* Send button */}
                  <button
                    onClick={sendReply}
                    disabled={((!replyText.trim() && !attachmentPreview) || !!attachmentPreview?.uploading || sending)}
                    className="w-10 h-10 rounded-full bg-[#075e54] hover:bg-[#064e46] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-all shadow-sm"
                  >
                    {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ─── Empty state ─── */
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] gap-5">
              <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-md">
                <MessageSquare size={44} className="text-[#075e54]" />
              </div>
              <div className="text-center max-w-sm px-4">
                <h2 className="text-xl font-bold text-slate-700 mb-2">Outflank WhatsApp Inbox</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Select a conversation on the left to view messages, or start a new chat with any customer.
                </p>
              </div>
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#075e54] text-white font-semibold text-sm hover:bg-[#064e46] transition-colors shadow-md"
              >
                <Plus size={16} />
                Start New Conversation
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-slate-100">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span className="text-[12px] text-slate-500 font-medium">End-to-end encrypted via Meta Cloud API</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
