'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, MessageCircle, Send, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react'
import { getAdminCache, setAdminCache } from '@/lib/adminCache'

interface StoreSettings {
  is_cod_enabled: boolean;
  cod_min_amount: number;
  free_shipping_threshold: number;
  flat_shipping_rate: number;
  whatsapp_support_phone?: string;
  whatsapp_admin_alerts_phone?: string;
  whatsapp_notifications_enabled?: boolean;
  whatsapp_provider?: 'meta_cloud' | 'interakt' | 'wati' | 'disabled';
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_access_token?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>({
    is_cod_enabled: true,
    cod_min_amount: 0,
    free_shipping_threshold: 0,
    flat_shipping_rate: 0,
    whatsapp_support_phone: '919999926273',
    whatsapp_admin_alerts_phone: '919999926273',
    whatsapp_notifications_enabled: false,
    whatsapp_provider: 'meta_cloud',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_access_token: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // WhatsApp Test State
  const [testPhone, setTestPhone] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async (force = false) => {
    // 1. Instant Cache Load
    const cached = getAdminCache<StoreSettings>('outflank_admin_settings', 10 * 60 * 1000, 'session')
    if (cached?.data) {
      setSettings(cached.data)
      setLoading(false)
      if (!cached.isStale && !force) {
        return // Instant 0ms load!
      }
    } else {
      setLoading(true)
    }

    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        const loaded: StoreSettings = {
          is_cod_enabled: data.is_cod_enabled ?? true,
          cod_min_amount: data.cod_min_amount ?? 0,
          free_shipping_threshold: data.free_shipping_threshold ?? 0,
          flat_shipping_rate: data.flat_shipping_rate ?? 0,
          whatsapp_support_phone: data.whatsapp_support_phone ?? '919999926273',
          whatsapp_admin_alerts_phone: data.whatsapp_admin_alerts_phone ?? '919999926273',
          whatsapp_notifications_enabled: Boolean(data.whatsapp_notifications_enabled),
          whatsapp_provider: data.whatsapp_provider ?? 'meta_cloud',
          whatsapp_phone_number_id: data.whatsapp_phone_number_id ?? '',
          whatsapp_business_account_id: data.whatsapp_business_account_id ?? '',
          whatsapp_access_token: data.whatsapp_access_token ?? '',
        }
        setSettings(loaded)
        setAdminCache('outflank_admin_settings', loaded, 'session')
        if (!testPhone && data.whatsapp_admin_alerts_phone) {
          setTestPhone(data.whatsapp_admin_alerts_phone)
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setAdminCache('outflank_admin_settings', settings, 'session')
        setMessage('Settings saved successfully!')
        setTimeout(() => setMessage(''), 3500)
      } else {
        setMessage('Failed to save settings.')
      }
    } catch (error) {
      setMessage('An error occurred while saving settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleSendTestMessage = async () => {
    if (!testPhone) {
      setTestResult({ success: false, message: 'Please provide a test recipient phone number.' })
      return
    }

    setTestSending(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/admin/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testPhone,
          message: 'Hello from Outflank! Your WhatsApp Business API integration is verified and operational.',
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message || 'Test message sent successfully!' })
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to dispatch test message. Check your API credentials.' })
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Network error dispatching test message' })
    } finally {
      setTestSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Store Settings</h1>
          <p className="text-xs text-gray-500 mt-1">Manage payment rules, shipping rates, and WhatsApp Business API integration.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${message.includes('success') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.includes('success') ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message}
        </div>
      )}

      {/* ─── 1. WhatsApp Business Integration Card ─── */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center border border-[#25D366]/20">
              <MessageCircle size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>WhatsApp Integration & Automated Notifications</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {settings.whatsapp_notifications_enabled ? 'Active' : 'Standby / Manual'}
                </span>
              </h2>
              <p className="text-xs text-gray-500">Configure transactional customer updates and direct click-to-chat numbers.</p>
            </div>
          </div>
        </div>

        {/* Master Toggle */}
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <div>
            <label className="text-sm font-bold text-gray-900">Automated Order & Shipping Notifications</label>
            <p className="text-xs text-gray-500 mt-0.5">
              Automatically dispatch WhatsApp messages to customers when orders are confirmed, dispatched with Shadowfax AWB, or delivered.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={settings.whatsapp_notifications_enabled}
              onChange={(e) => setSettings({ ...settings, whatsapp_notifications_enabled: e.target.checked })}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366]"></div>
          </label>
        </div>

        {/* Phone Number Routing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Storefront Support WhatsApp Phone
            </label>
            <p className="text-[11px] text-gray-500 mb-2">Used by website buttons, catalog inquiry CTAs, and the floating chat bubble.</p>
            <input
              type="text"
              placeholder="919999926273"
              value={settings.whatsapp_support_phone || ''}
              onChange={(e) => setSettings({ ...settings, whatsapp_support_phone: e.target.value })}
              className="block w-full rounded-xl border border-gray-300 py-2 px-3.5 text-gray-900 text-sm focus:ring-2 focus:ring-black font-mono shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Admin Alert WhatsApp Phone
            </label>
            <p className="text-[11px] text-gray-500 mb-2">Store owner number that receives instant alerts for new retail orders and B2B corporate leads.</p>
            <input
              type="text"
              placeholder="919999926273"
              value={settings.whatsapp_admin_alerts_phone || ''}
              onChange={(e) => setSettings({ ...settings, whatsapp_admin_alerts_phone: e.target.value })}
              className="block w-full rounded-xl border border-gray-300 py-2 px-3.5 text-gray-900 text-sm focus:ring-2 focus:ring-black font-mono shadow-2xs"
            />
          </div>
        </div>

        {/* Provider Selection */}
        <div className="pt-4 border-t border-gray-100">
          <label className="block text-xs font-bold text-gray-900 mb-1.5">
            Automated API Provider Engine
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'meta_cloud', name: 'Meta Cloud API (Direct)', desc: 'Zero monthly fee · Raw Meta rates (~₹0.14/msg)' },
              { id: 'interakt', name: 'Interakt (BSP)', desc: 'Multi-agent inbox · Broadcast builder' },
              { id: 'wati', name: 'Wati / AISensy', desc: 'Flow builder · Shared CRM' },
            ].map((p) => (
              <div
                key={p.id}
                onClick={() => setSettings({ ...settings, whatsapp_provider: p.id as any })}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  settings.whatsapp_provider === p.id 
                    ? 'border-gray-900 bg-gray-50/80 shadow-2xs' 
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">{p.name}</span>
                  {settings.whatsapp_provider === p.id && <span className="w-2 h-2 rounded-full bg-[#25D366]" />}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* API Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-gray-100 bg-slate-50/50 p-4 rounded-xl border border-gray-200/80">
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              WhatsApp Phone Number ID
            </label>
            <p className="text-[10px] text-gray-500 mb-1.5">From Meta App Dashboard &gt; WhatsApp &gt; API Setup.</p>
            <input
              type="text"
              placeholder="e.g. 104829104810294"
              value={settings.whatsapp_phone_number_id || ''}
              onChange={(e) => setSettings({ ...settings, whatsapp_phone_number_id: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 py-1.5 px-3 text-gray-900 text-xs font-mono bg-white shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              WhatsApp Business Account ID (WABA)
            </label>
            <p className="text-[10px] text-gray-500 mb-1.5">Your Meta Business Manager WABA ID.</p>
            <input
              type="text"
              placeholder="e.g. 294810294810294"
              value={settings.whatsapp_business_account_id || ''}
              onChange={(e) => setSettings({ ...settings, whatsapp_business_account_id: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 py-1.5 px-3 text-gray-900 text-xs font-mono bg-white shadow-2xs"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Permanent System User Access Token / API Key
            </label>
            <p className="text-[10px] text-gray-500 mb-1.5">Meta permanent Bearer token with <code>whatsapp_business_messaging</code> permission.</p>
            <input
              type="password"
              placeholder="EAAB..."
              value={settings.whatsapp_access_token || ''}
              onChange={(e) => setSettings({ ...settings, whatsapp_access_token: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 py-1.5 px-3 text-gray-900 text-xs font-mono bg-white shadow-2xs"
            />
          </div>
        </div>

        {/* Test Connection Box */}
        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-50/40 p-4 rounded-xl border border-emerald-200/60">
          <div className="space-y-0.5 w-full sm:w-auto">
            <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-700" />
              Verify WhatsApp API Connection
            </span>
            <p className="text-[11px] text-gray-600">Send an instant live test message to verify your API credentials.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="919999926273"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="w-36 rounded-lg border border-gray-300 py-1.5 px-3 text-xs font-mono bg-white shadow-2xs"
            />
            <button
              type="button"
              onClick={handleSendTestMessage}
              disabled={testSending}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 shrink-0"
            >
              {testSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              <span>Send Test</span>
            </button>
          </div>
        </div>

        {testResult && (
          <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {testResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* ─── 2. Payment Rules Card ─── */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-2xl p-6 md:p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          Payment Rules
        </h2>
        
        <div className="space-y-6">
          {/* COD Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-sm font-medium leading-6 text-gray-900">Enable Cash on Delivery (COD)</label>
              <p className="text-sm text-gray-500">Allow customers to pay upon delivery.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.is_cod_enabled}
                onChange={(e) => setSettings({ ...settings, is_cod_enabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          {/* COD Minimum */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Minimum Order Amount for COD</label>
              <p className="text-xs text-gray-500 mb-2">Orders below this amount cannot use COD.</p>
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">₹</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={settings.cod_min_amount}
                  onChange={(e) => setSettings({ ...settings, cod_min_amount: Number(e.target.value) })}
                  className="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. Shipping Rules Card ─── */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-2xl p-6 md:p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          Shipping Rules
        </h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Flat Shipping Rate</label>
              <p className="text-xs text-gray-500 mb-2">Base delivery fee applied to orders.</p>
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">₹</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={settings.flat_shipping_rate}
                  onChange={(e) => setSettings({ ...settings, flat_shipping_rate: Number(e.target.value) })}
                  className="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Free Delivery Threshold</label>
              <p className="text-xs text-gray-500 mb-2">Orders above this amount get free shipping.</p>
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">₹</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={settings.free_shipping_threshold}
                  onChange={(e) => setSettings({ ...settings, free_shipping_threshold: Number(e.target.value) })}
                  className="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
