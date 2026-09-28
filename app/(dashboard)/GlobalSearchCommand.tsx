'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ShoppingBag, Package, Users, Command } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function GlobalSearchCommand() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ type: string, title: string, subtitle: string, url: string, icon: any }[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen((open) => !open)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }

    const searchDB = async () => {
      setLoading(true)
      const supabase = createClient()
      const searchStr = `%${query}%`

      try {
        const [ordersRes, productsRes, customersRes] = await Promise.all([
          supabase.from('retail_orders').select('id, customer_name, total_amount').or(`id.ilike.${searchStr},customer_name.ilike.${searchStr}`).limit(3),
          supabase.from('products').select('id, name, sku').or(`name.ilike.${searchStr},sku.ilike.${searchStr}`).limit(3),
          supabase.from('customers').select('id, full_name, email').or(`full_name.ilike.${searchStr},email.ilike.${searchStr}`).limit(3)
        ])

        const combined = []
        if (ordersRes.data) {
          combined.push(...ordersRes.data.map(o => ({
            type: 'Order',
            title: `Order #${o.id.split('-')[0].toUpperCase()}`,
            subtitle: `${o.customer_name} • ₹${o.total_amount}`,
            url: `/orders?search=${o.id}`,
            icon: ShoppingBag
          })))
        }
        if (productsRes.data) {
          combined.push(...productsRes.data.map(p => ({
            type: 'Product',
            title: p.name,
            subtitle: `SKU: ${p.sku || 'N/A'}`,
            url: `/products`,
            icon: Package
          })))
        }
        if (customersRes.data) {
          combined.push(...customersRes.data.map(c => ({
            type: 'Customer',
            title: c.full_name || c.email || 'Unknown',
            subtitle: c.email || '',
            url: `/customers`,
            icon: Users
          })))
        }

        setResults(combined)
      } catch (e) {
        console.error('Search error:', e)
      } finally {
        setLoading(false)
      }
    }

    const timeout = setTimeout(searchDB, 300)
    return () => clearTimeout(timeout)
  }, [query])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-24 p-4" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-2xl bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/5 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-black/5">
          <Search size={20} className="text-[#86868b] mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Search orders, products, customers..."
            className="flex-1 bg-transparent border-none focus:outline-none text-lg text-[#1d1d1f] placeholder:text-[#86868b]"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-1">
            <kbd className="bg-black/5 px-2 py-1 rounded text-xs font-medium text-[#86868b] uppercase font-sans tracking-widest"><Command size={10} className="inline mr-0.5"/>K</kbd>
            <kbd className="bg-black/5 px-2 py-1 rounded text-xs font-medium text-[#86868b] uppercase font-sans tracking-widest">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading ? (
            <div className="px-4 py-8 text-center text-[#86868b] text-sm flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result, i) => (
                <button
                  key={i}
                  onClick={() => {
                    router.push(result.url)
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-black/5 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] group-hover:bg-white group-hover:shadow-sm">
                    <result.icon size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1d1d1f]">{result.title}</h4>
                    <p className="text-xs text-[#86868b] mt-0.5">{result.subtitle}</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#86868b] px-2 py-1 rounded bg-[#f5f5f7]">
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="px-4 py-8 text-center text-[#86868b] text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[#86868b] text-sm">
              Start typing to search your store...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
