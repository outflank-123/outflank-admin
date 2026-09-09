import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import CategoriesClient from './CategoriesClient'

export const metadata: Metadata = {
  title: 'Categories | Outflank Admin',
}

export default async function AdminCategoriesPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">Categories</h1>
          <p className="text-[#86868b] text-[15px] mt-1.5 font-medium">{categories?.length ?? 0} total categories</p>
        </div>
      </div>
      <Suspense fallback={<div className="h-64 bg-white/60 backdrop-blur-xl rounded-[24px] animate-pulse" />}>
        <CategoriesClient initialCategories={categories ?? []} />
      </Suspense>
    </div>
  )
}
