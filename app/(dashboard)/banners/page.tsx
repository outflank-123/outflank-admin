import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BannersClient from './BannersClient'

export const metadata = {
  title: 'Banners | Admin',
}

export default async function BannersAdminPage() {
  const supabase = await createClient()

  // Relaxed Auth check - just ensure there's a user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 3. Fetch banners
  const { data: banners, error: bannersError } = await supabase
    .from('banners')
    .select('*')
    .order('sort_order', { ascending: true })

  if (bannersError) {
    console.error('Error fetching banners:', bannersError)
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">Homepage Banners</h1>
          <p className="text-[#86868b] text-[13px] mt-1">Manage dynamic hero banners displayed on the storefront.</p>
        </div>
      </div>
      
      <BannersClient initialBanners={banners || []} />
    </div>
  )
}
