import AdminSidebar from './AdminSidebar'
import GlobalSearchCommand from './GlobalSearchCommand'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  let role = 'admin'
  const { data } = await supabase.from('admin_profiles').select('role').eq('id', user.id).single()
  if (data?.role) role = data.role

  return (
    <div className="h-screen bg-[#fbfbfd] flex selection:bg-[#e3231c]/20 overflow-hidden">
      <AdminSidebar userEmail={user?.email} userRole={role} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto p-6 lg:p-8 h-screen overflow-y-auto">
        <GlobalSearchCommand />
        {children}
      </main>
    </div>
  )
}
