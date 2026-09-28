import { fetchDashboardData } from './dashboardActions'
import DashboardClient from './DashboardClient'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 60
export const dynamic = 'force-dynamic'

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const range = (params?.range as string) || 'last_30_days'
  const start = params?.start as string | undefined
  const end = params?.end as string | undefined

  const data = await fetchDashboardData(range, start, end)

  return (
    <DashboardClient data={data} currentRange={range} />
  )
}
