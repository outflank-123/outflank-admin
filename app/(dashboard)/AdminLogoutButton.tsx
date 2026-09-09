'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function AdminLogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      id="admin-logout-btn"
      className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f]/50 hover:text-[#e3231c] transition-colors"
    >
      <LogOut size={14} />
      Logout
    </button>
  )
}
