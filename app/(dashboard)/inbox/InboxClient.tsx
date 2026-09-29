'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Search, CheckCheck, Check, MessageSquare, Send, Smile,
  Paperclip, MoreVertical, Phone, Video, ArrowLeft,
  Circle, RefreshCw, X, ShieldCheck, Clock, CheckCircle2,
  User, ChevronDown, Filter, Inbox
} from 'lucide-react'

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

// ── Supabase Realtime client (anon key for browser) ─────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Helpers ─────────────────────────────────────────────────────────────────
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

function getAvatarColor(phone: string) {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-sky-600',
  ]
  const idx = parseInt(phone.slice(-2), 10) % colors.length
  return colors[idx]
}

function StatusTick({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck size={14} className="text-[#34B7F1] shrink-0" />
  if (status === 'delivered') return <CheckCheck size={14} className="text-slate-400 shrink-0" />
  if (status === 'sent') return <Check size={14} className="text-slate-400 shrink-0" />
  if (status === 'failed') return <X size={14} className="text-rose-500 shrink-0" />
  return null
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function InboxClient({ initialConversations }: InboxClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'open' | 'resolved'>('all')
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // ── Scroll to bottom of chat ──────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // ── Load messages for active conversation ─────────────────────────────────
  const loadMessages = useCallback(async (conv: Conversation) => {
    setLoadingMessages(true)
    const res = await fetch(`/api/admin/whatsapp/messages?conversationId=${conv.id}`)
    const data = await res.json()
    setMessages(data.messages || [])
    setLoadingMessages(false)

    // Mark as read
    await fetch('/api/admin/whatsapp/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conv.id }),
    })
    setConversations(prev =>
      prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
    )
  }, [])

  // ── Open conversation ─────────────────────────────────────────────────────
  const openConversation = useCallback((conv: Conversation) => {
    setActiveConv(conv)
    setMobileShowChat(true)
    loadMessages(conv)
  }, [loadMessages])

  // ── Supabase Realtime subscriptions ──────────────────────────────────────
  useEffect(() => {
    // Listen for new/updated conversations
    const convChannel = supabase
      .channel('wa_conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_conversations',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setConversations(prev => [payload.new as Conversation, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setConversations(prev =>
            prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c)
              .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          )
        }
      })
      .subscribe()

    // Listen for new messages
    const msgChannel = supabase
      .channel('wa_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
      }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => {
          if (activeConv && newMsg.conversation_id === activeConv.id) {
            if (prev.find(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          }
          return prev
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_messages',
      }, (payload) => {
        const updated = payload.new as Message
        setMessages(prev =>
          prev.map(m => m.id === updated.id ? { ...m, ...updated } : m)
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(convChannel)
      supabase.removeChannel(msgChannel)
    }
  }, [activeConv])

  // ── Send reply ────────────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!replyText.trim() || !activeConv || sending) return
    setSending(true)
    const text = replyText.trim()
    setReplyText('')

    // Optimistic update
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeConv.id,
      wamid: null,
      direction: 'outbound',
      message_type: 'text',
      body: text,
      media_url: null,
      status: 'sending',
      sent_by: 'admin',
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/admin/whatsapp/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConv.id,
          to: activeConv.contact_phone,
          message: text,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Mark optimistic message as failed
        setMessages(prev =>
          prev.map(m => m.id === optimisticMsg.id ? { ...m, status: 'failed' } : m)
        )
        alert(`Failed to send: ${data.error}`)
      } else {
        setMessages(prev =>
          prev.map(m => m.id === optimisticMsg.id ? { ...m, status: 'sent', wamid: data.wamid } : m)
        )
      }
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === optimisticMsg.id ? { ...m, status: 'failed' } : m)
      )
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendReply()
    }
  }

  // ── Filtered conversations ────────────────────────────────────────────────
  const filteredConversations = conversations.filter(c => {
    const matchesSearch = searchQuery
      ? c.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contact_phone.includes(searchQuery)
      : true
    const matchesFilter =
      filterStatus === 'all'      ? true :
      filterStatus === 'unread'   ? c.unread_count > 0 :
      filterStatus === 'resolved' ? c.status === 'resolved' :
      c.status === 'open'
    return matchesSearch && matchesFilter
  })

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  // ── Group messages by date ────────────────────────────────────────────────
  const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const label = formatDateLabel(msg.timestamp)
    const last  = acc[acc.length - 1]
    if (!last || last.date !== label) {
      acc.push({ date: label, msgs: [msg] })
    } else {
      last.msgs.push(msg)
    }
    return acc
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ═══════════════════ LEFT: CONVERSATION LIST ═══════════════════ */}
      <div className={`flex flex-col bg-white border-r border-slate-200 w-full md:w-[340px] lg:w-[380px] shrink-0 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 bg-[#f0f2f5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              OF
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800">Outflank Inbox</p>
              <p className="text-[11px] text-slate-500">WhatsApp Business</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                {totalUnread}
              </span>
            )}
            <button className="p-2 hover:bg-white rounded-full transition-colors">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-[#f0f2f5]">
          <div className="flex items-center gap-2 bg-white rounded-full px-3 py-2 border border-slate-200">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-700"
            />
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
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'unread' && totalUnread > 0 && (
                <span className="ml-1 bg-white/30 rounded-full px-1">{totalUnread}</span>
              )}
            </button>
          ))}
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Inbox size={28} className="text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No conversations yet</p>
              <p className="text-slate-400 text-xs max-w-[220px]">
                When customers reply to your broadcasts, their messages will appear here.
              </p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 hover:bg-[#f5f6f6] transition-colors border-b border-slate-50 text-left ${
                  activeConv?.id === conv.id ? 'bg-[#f0f2f5]' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(conv.contact_phone)} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm`}>
                  {getInitials(conv.contact_name)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                      {conv.contact_name}
                    </p>
                    <span className={`text-[11px] shrink-0 ml-2 ${conv.unread_count > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[12px] truncate ${conv.unread_count > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                      {conv.last_message || 'No messages yet'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ═══════════════════ CENTER: CHAT WINDOW ═══════════════════════ */}
      <div className={`flex-1 flex flex-col min-w-0 ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
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
                <p className="font-bold text-sm text-slate-900 truncate">{activeConv.contact_name}</p>
                <p className="text-[11px] text-slate-500 truncate">+{activeConv.contact_phone}</p>
              </div>

              <div className="flex items-center gap-2 text-slate-500">
                <button className="p-2 hover:bg-white rounded-full transition-colors"><Video size={18} /></button>
                <button className="p-2 hover:bg-white rounded-full transition-colors"><Phone size={18} /></button>
                <button className="p-2 hover:bg-white rounded-full transition-colors"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
              style={{
                background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' opacity='0.03'%3E%3Ctext y='70' font-size='70'%3E💬%3C/text%3E%3C/svg%3E"), linear-gradient(135deg, #dfe7ed 0%, #e8ecef 100%)`,
              }}
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw size={24} className="text-emerald-500 animate-spin" />
                    <p className="text-slate-500 text-sm">Loading messages...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-16 h-16 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-sm">
                    <MessageSquare size={28} className="text-slate-400" />
                  </div>
                  <p className="text-slate-600 text-sm font-medium">No messages yet</p>
                  <p className="text-slate-400 text-xs text-center max-w-[200px]">
                    Send a message to start the conversation.
                  </p>
                </div>
              ) : (
                groupedMessages.map(group => (
                  <div key={group.date}>
                    {/* Date label */}
                    <div className="flex justify-center my-4">
                      <span className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm text-[11px] font-semibold text-slate-500 shadow-sm">
                        {group.date}
                      </span>
                    </div>

                    {group.msgs.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex mb-1.5 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed ${
                            msg.direction === 'outbound'
                              ? 'bg-[#d9fdd3] rounded-tr-sm text-slate-800'
                              : 'bg-white rounded-tl-sm text-slate-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.body || `[${msg.message_type}]`}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-slate-400">
                              {formatTime(msg.timestamp)}
                            </span>
                            {msg.direction === 'outbound' && (
                              <StatusTick status={msg.status} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="bg-[#f0f2f5] px-3 py-2 flex items-end gap-2 border-t border-slate-200 shrink-0">
              <button className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-full transition-all shrink-0">
                <Smile size={22} />
              </button>
              <button className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-full transition-all shrink-0">
                <Paperclip size={22} />
              </button>

              <div className="flex-1 bg-white rounded-2xl border border-slate-200 px-4 py-2.5 min-h-[42px] flex items-end">
                <textarea
                  ref={inputRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message"
                  rows={1}
                  className="flex-1 text-sm text-slate-800 bg-transparent outline-none resize-none placeholder:text-slate-400 max-h-32 overflow-y-auto"
                  style={{ lineHeight: '1.5' }}
                />
              </div>

              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending}
                className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-all shadow-sm"
              >
                {sending ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </>
        ) : (
          // Empty state — no conversation selected
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] gap-6">
            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-md">
              <MessageSquare size={44} className="text-emerald-500" />
            </div>
            <div className="text-center max-w-sm">
              <h2 className="text-xl font-bold text-slate-700 mb-2">Outflank WhatsApp Inbox</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Select a conversation from the left to view messages and reply to your customers in real time.
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-slate-100">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span className="text-[12px] text-slate-500 font-medium">End-to-end encrypted via Meta Cloud API</span>
            </div>
            {totalUnread > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100">
                <Circle size={10} className="fill-emerald-500 text-emerald-500" />
                <span className="text-[12px] text-emerald-700 font-semibold">{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
