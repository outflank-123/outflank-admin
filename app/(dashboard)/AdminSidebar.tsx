'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, ExternalLink, Tags, Package, Image as ImageIcon, Settings, ShoppingBag } from 'lucide-react'
import AdminLogoutButton from './AdminLogoutButton'

interface AdminSidebarProps {
  userEmail?: string
  userRole?: string
}

export default function AdminSidebar({ userEmail, userRole = 'admin' }: AdminSidebarProps) {
  const pathname = usePathname()

  let navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { href: '/banners', icon: ImageIcon, label: 'Banners' },
    { href: '/leads', icon: Users, label: 'Leads Pipeline' },
    { href: '/categories', icon: Tags, label: 'Categories' },
    { href: '/products', icon: Package, label: 'Products' },
    { href: '/orders', icon: ShoppingBag, label: 'Retail Orders' },
    { href: '/settings', icon: Settings, label: 'Store Settings' },
  ]

  if (userRole === 'junior') {
    navItems = [
      { href: '/leads', icon: Users, label: 'Leads Pipeline' },
      { href: '/products', icon: Package, label: 'Products' },
    ]
  }

  if (userRole === 'super_admin') {
    navItems.push({ href: '/users', icon: Users, label: 'Manage Users' })
  }

  return (
    <aside className="w-[260px] shrink-0 bg-white/70 backdrop-blur-2xl border-r border-black/5 flex flex-col h-screen z-20">
      {/* Logo */}
      <div className="px-6 py-8 border-b border-black/[0.03]">
        <Link href="/" className="block transition-transform hover:scale-[0.98] origin-left">
          <Image
            src="/logo/outflank-logo.png"
            alt="Outflank CRM"
            width={140}
            height={46}
            className="h-10 w-auto object-contain"
          />
        </Link>
        <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 border border-black/5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold tracking-widest text-[#1d1d1f]/60 uppercase">{userRole.replace('_', ' ')} Portal</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname?.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all group ${
                isActive 
                  ? 'bg-black/[0.04] text-[#e3231c] shadow-sm font-semibold' 
                  : 'text-[#1d1d1f]/70 hover:text-[#1d1d1f] hover:bg-black/[0.02]'
              }`}
            >
              <item.icon 
                size={18} 
                className={`transition-colors ${
                  isActive ? 'text-[#e3231c]' : 'text-[#1d1d1f]/40 group-hover:text-[#1d1d1f]/70'
                }`} 
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-6 border-t border-black/[0.03] bg-gradient-to-t from-white/50 to-transparent shrink-0">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e3231c] to-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
            {userEmail?.charAt(0).toUpperCase() ?? 'A'}
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold text-[#1d1d1f] truncate">{userEmail ?? 'Admin'}</span>
            <span className="text-[10px] text-[#1d1d1f]/50">Super Administrator</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between px-2">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors"
          >
            <ExternalLink size={14} />
            Live Site
          </Link>
          <div className="w-[1px] h-3 bg-black/10" />
          <AdminLogoutButton />
        </div>
      </div>
    </aside>
  )
}
