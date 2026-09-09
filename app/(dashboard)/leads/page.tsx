import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import LeadsTableClient from './LeadsTableClient'

export const metadata: Metadata = {
  title: 'Leads | Outflank Admin',
}

interface LeadsPageProps {
  searchParams: Promise<{ status?: string; q?: string }>
}

export default async function AdminLeadsPage({ searchParams }: LeadsPageProps) {
  const { status, q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('leads')
    .select('id, name, company, email, phone, requirements, product_name, status, source, created_at, updated_at')
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">Leads</h1>
        <p className="text-[#6e6e73] text-sm mt-1">{leads?.length ?? 0} total leads</p>
      </div>
      <Suspense fallback={<div className="h-64 bg-white rounded-2xl animate-pulse" />}>
        <LeadsTableClient leads={leads ?? []} activeStatus={status ?? 'all'} />
      </Suspense>
    </div>
  )
}
