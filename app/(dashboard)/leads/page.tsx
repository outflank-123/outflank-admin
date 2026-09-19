import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import LeadsTableClient from './LeadsTableClient'

export const metadata: Metadata = {
  title: 'Sales CRM | Outflank Admin',
}

interface LeadsPageProps {
  searchParams: Promise<{ status?: string; q?: string }>
}

export default async function AdminLeadsPage({ searchParams }: LeadsPageProps) {
  const { status, q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('leads')
    .select('id, name, company, email, phone, requirements, product_name, status, source, notes, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: leads } = await query

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-[#1d1d1f] tracking-tight">Sales CRM & Leads Pipeline</h1>
          <p className="text-[#6e6e73] text-sm mt-0.5">Manage B2B corporate inquiries, track pipeline stages, and close deals.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-bold self-start md:self-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{leads?.length ?? 0} Active Inquiries</span>
        </div>
      </div>

      <Suspense fallback={<div className="h-96 bg-white/60 rounded-3xl animate-pulse" />}>
        <LeadsTableClient leads={leads ?? []} activeStatus={status ?? 'all'} />
      </Suspense>
    </div>
  )
}
