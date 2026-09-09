import { createClient } from '@/lib/supabase/server'
import { Users, Clock, PhoneCall, CheckCircle2, XCircle } from 'lucide-react'

const STATUS_CONFIG = {
  new:       { label: 'New',       color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: Users },
  contacted: { label: 'Contacted', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: PhoneCall },
  qualified: { label: 'Qualified', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  closed:    { label: 'Closed',    color: 'bg-slate-50 text-slate-500 border-slate-200',  icon: XCircle },
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Get lead counts per status
  const { data: leads } = await supabase
    .from('leads')
    .select('status, created_at')
    .order('created_at', { ascending: false })

  const counts = {
    total:     leads?.length ?? 0,
    new:       leads?.filter((l) => l.status === 'new').length ?? 0,
    contacted: leads?.filter((l) => l.status === 'contacted').length ?? 0,
    qualified: leads?.filter((l) => l.status === 'qualified').length ?? 0,
    closed:    leads?.filter((l) => l.status === 'closed').length ?? 0,
  }

  // Recent leads (last 5)
  const { data: recentLeads } = await supabase
    .from('leads')
    .select('id, name, company, product_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">Overview</h1>
        <p className="text-[#86868b] text-[15px] mt-1.5 font-medium">Your lead pipeline at a glance.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-12">
        {[
          { label: 'Total Leads', value: counts.total, icon: Users, color: 'from-[#e3231c]/10 to-orange-500/10 text-[#e3231c] ring-[#e3231c]/20' },
          { label: 'New Inquiries', value: counts.new, icon: Clock, color: 'from-blue-500/10 to-cyan-500/10 text-blue-600 ring-blue-500/20' },
          { label: 'Qualified', value: counts.qualified, icon: CheckCircle2, color: 'from-emerald-500/10 to-green-500/10 text-emerald-600 ring-emerald-500/20' },
          { label: 'Closed', value: counts.closed, icon: XCircle, color: 'from-slate-400/10 to-slate-300/10 text-slate-500 ring-slate-400/20' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] p-6 transition-transform hover:-translate-y-1 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.08)] duration-300">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-gradient-to-br ring-1 ring-inset ${stat.color}`}>
              <stat.icon size={22} />
            </div>
            <div className="text-[40px] font-semibold tracking-tighter text-[#1d1d1f] leading-none mb-2">{stat.value}</div>
            <div className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent leads */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-8 py-6 border-b border-black/[0.03] flex items-center justify-between bg-white/40">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">Recent Activity</h2>
          <a href="/leads" className="text-[13px] font-medium text-[#e3231c] hover:text-[#b91a14] transition-colors bg-[#e3231c]/5 hover:bg-[#e3231c]/10 px-3 py-1.5 rounded-full">
            View All Pipeline
          </a>
        </div>
        <div className="divide-y divide-black/[0.03]">
          {recentLeads && recentLeads.length > 0 ? (
            recentLeads.map((lead) => {
              const cfg = STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG]
              return (
                <div key={lead.id} className="px-8 py-5 flex items-center justify-between hover:bg-white/80 transition-colors group">
                  <div className="flex flex-col gap-1">
                    <p className="text-[15px] font-semibold text-[#1d1d1f]">{lead.name}</p>
                    <p className="text-[13px] font-medium text-[#86868b]">
                      {lead.company}
                      {lead.product_name && <span className="text-[#1d1d1f]/30 mx-1.5">•</span>}
                      {lead.product_name && <span className="text-[#1d1d1f]/60">{lead.product_name}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[12px] font-medium text-[#86868b]">
                      {new Date(lead.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${cfg.color}`}>
                      <cfg.icon size={12} />
                      {cfg.label}
                    </span>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="px-8 py-16 text-center text-[#86868b] text-[15px] font-medium bg-white/20">
              Your pipeline is empty. Share your catalog to start generating leads.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
