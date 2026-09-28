'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Clock, PhoneCall, CheckCircle2, XCircle, ShoppingBag, IndianRupee, Package, Truck, ArrowUpRight, ArrowDownRight, TrendingUp, Calendar, Download } from 'lucide-react'
import DashboardCharts from './DashboardCharts'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' }
]

export default function DashboardClient({ data, currentRange }: { data: any, currentRange: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === 'custom') {
      const today = new Date().toISOString().split('T')[0]
      router.push(`/?range=custom&start=${today}&end=${today}`)
    } else {
      router.push(`/?range=${val}`)
    }
  }

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    const start = searchParams.get('start') || new Date().toISOString().split('T')[0]
    const end = searchParams.get('end') || new Date().toISOString().split('T')[0]
    if (type === 'start') {
      router.push(`/?range=custom&start=${value}&end=${end}`)
    } else {
      router.push(`/?range=custom&start=${start}&end=${value}`)
    }
  }

  const exportCSV = () => {
    const csvContent = [
      ['Metric', 'Current', 'Change %'].join(','),
      ['Revenue', data.revenue.current, data.revenue.change].join(','),
      ['Orders', data.orders.current, data.orders.change].join(','),
      ['AOV', data.aov.current, 0].join(','),
      ['Leads', data.leads.current, data.leads.change].join(',')
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard_metrics_${currentRange}.csv`
    a.click()
  }

  const renderMetricCard = (title: string, current: number, change: number, Icon: any, color: string, prefix = '', suffix = '') => {
    const isPositive = change >= 0
    const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight
    
    return (
      <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] p-6 transition-transform hover:-translate-y-1 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.08)] duration-300 relative overflow-hidden group cursor-pointer">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-gradient-to-br ring-1 ring-inset ${color}`}>
          <Icon size={22} />
        </div>
        <div className="text-[36px] font-semibold tracking-tighter text-[#1d1d1f] leading-none mb-2">
          {prefix}{typeof current === 'number' && prefix === '' && suffix === '' ? current.toLocaleString() : current}{suffix}
        </div>
        <div className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">{title}</div>
        
        {change !== undefined && (
          <div className={`absolute top-6 right-6 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            <ChangeIcon size={14} />
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
    )
  }

  if (!data) return <div className="p-8 text-center text-gray-500">Loading data...</div>

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">Overview</h1>
          <p className="text-[#86868b] text-[15px] mt-1.5 font-medium">Your store at a glance.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
              <select 
                value={currentRange}
                onChange={handleRangeChange}
                className="pl-9 pr-10 py-2.5 rounded-xl border border-black/5 bg-white text-[13px] font-semibold text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 cursor-pointer shadow-sm appearance-none"
              >
                {RANGES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            
            {currentRange === 'custom' && (
              <div className="flex items-center gap-2 bg-white border border-black/5 rounded-xl shadow-sm px-2">
                <input 
                  type="date" 
                  value={searchParams.get('start') || ''} 
                  onChange={(e) => handleCustomDateChange('start', e.target.value)}
                  className="py-2.5 text-[13px] font-semibold text-[#1d1d1f] focus:outline-none bg-transparent"
                />
                <span className="text-[#86868b] text-[13px] font-medium">to</span>
                <input 
                  type="date" 
                  value={searchParams.get('end') || ''} 
                  onChange={(e) => handleCustomDateChange('end', e.target.value)}
                  className="py-2.5 text-[13px] font-semibold text-[#1d1d1f] focus:outline-none bg-transparent"
                />
              </div>
            )}
          </div>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1d1d1f] hover:bg-black text-white text-[13px] font-semibold rounded-xl shadow-sm transition-all">
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div>
        <h2 className="text-[13px] font-bold text-[#86868b] uppercase tracking-widest mb-4">Retail Performance</h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          {renderMetricCard('Total Revenue', data.revenue.current, data.revenue.change, IndianRupee, 'from-emerald-500/10 to-green-500/10 text-emerald-600 ring-emerald-500/20', '₹')}
          {renderMetricCard('Orders', data.orders.current, data.orders.change, ShoppingBag, 'from-[#e3231c]/10 to-orange-500/10 text-[#e3231c] ring-[#e3231c]/20')}
          {renderMetricCard('Avg Order Value', Math.round(data.aov.current), 0, TrendingUp, 'from-blue-500/10 to-cyan-500/10 text-blue-600 ring-blue-500/20', '₹')}
          {renderMetricCard('Cancellation Rate', data.cancelRate.current, 0, XCircle, 'from-red-500/10 to-rose-500/10 text-red-600 ring-red-500/20', '', '%')}
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts revenueData={data.chartData} statusData={data.statusData} />

      {/* Leads Funnel */}
      <div>
        <h2 className="text-[13px] font-bold text-[#86868b] uppercase tracking-widest mb-4">B2B Lead Pipeline</h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          {renderMetricCard('Total Leads', data.leads.current, data.leads.change, Users, 'from-blue-500/10 to-cyan-500/10 text-blue-600 ring-blue-500/20')}
          {renderMetricCard('Conversion Rate', data.leadConversion.current, 0, CheckCircle2, 'from-emerald-500/10 to-green-500/10 text-emerald-600 ring-emerald-500/20', '', '%')}
          {renderMetricCard('New Inquiries', data.feed.filter((f: any) => f.type === 'lead' && f.status === 'new').length, 0, Clock, 'from-amber-500/10 to-orange-500/10 text-amber-600 ring-amber-500/20')}
          {renderMetricCard('Closed Deals', data.feed.filter((f: any) => f.type === 'lead' && f.status === 'closed').length, 0, IndianRupee, 'from-purple-500/10 to-fuchsia-500/10 text-purple-600 ring-purple-500/20')}
        </div>
      </div>

      {/* Unified Feed & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-8 py-5 border-b border-black/[0.03] bg-white/40">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">Recent Activity Feed</h2>
          </div>
          <div className="divide-y divide-black/[0.03] max-h-[400px] overflow-y-auto">
            {data.feed.length > 0 ? data.feed.map((item: any) => (
              <div key={`${item.type}-${item.id}`} className="px-8 py-4 flex items-center justify-between hover:bg-white/80 transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === 'order' ? 'bg-emerald-50 text-emerald-600' : item.type === 'lead' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {item.type === 'order' ? <ShoppingBag size={18} /> : item.type === 'lead' ? <Users size={18} /> : <CheckCircle2 size={18} />}
                  </div>
                  <div>
                    <h4 className="text-[14px] font-semibold text-[#1d1d1f]">{item.title}</h4>
                    <p className="text-[12px] font-medium text-[#86868b] capitalize">{item.type} {item.status ? `• ${item.status}` : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  {item.amount && <div className="text-[14px] font-bold text-[#1d1d1f]">₹{item.amount}</div>}
                  <div className="text-[12px] font-medium text-[#86868b]">{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
              </div>
            )) : (
              <div className="px-8 py-16 text-center text-[#86868b] text-[14px]">No activity in this period.</div>
            )}
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-6 py-5 border-b border-black/[0.03] bg-white/40">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight text-red-600 flex items-center gap-2">
              <Package size={18} /> Low Stock Alert
            </h2>
          </div>
          <div className="divide-y divide-black/[0.03] p-4">
            {data.lowStock.length > 0 ? data.lowStock.map((p: any) => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#1d1d1f] truncate pr-4">{p.name}</span>
                <span className="text-[12px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded shrink-0">{p.stock_quantity} left</span>
              </div>
            )) : (
              <div className="py-8 text-center text-[#86868b] text-[13px]">Stock levels are healthy.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
