import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ProductsClient from './ProductsClient'

export const metadata: Metadata = {
  title: 'Products | Outflank Admin',
}

export default async function AdminProductsPage() {
  const supabase = await createClient()

  // Fetch products with their category names
  const { data: products } = await supabase
    .from('products')
    .select('*, categories(name)')
    .order('created_at', { ascending: false })

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('sort_order', { ascending: true })

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">Products</h1>
          <p className="text-[#86868b] text-[15px] mt-1.5 font-medium">{products?.length ?? 0} total products in catalog</p>
        </div>
      </div>
      <Suspense fallback={<div className="h-64 bg-white/60 backdrop-blur-xl rounded-[24px] animate-pulse" />}>
        <ProductsClient initialProducts={products ?? []} categories={categories ?? []} />
      </Suspense>
    </div>
  )
}
