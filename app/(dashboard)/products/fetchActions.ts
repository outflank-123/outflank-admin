'use server'

import { createClient } from '@/lib/supabase/server'

export async function fetchProductsAction({
  page = 1,
  limit = 50,
  search = '',
  category = 'all',
  status = 'all'
}) {
  const supabase = await createClient()
  
  let query = supabase.from('products').select('*, categories(name)', { count: 'exact' })

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`)
  }

  if (category !== 'all') {
    query = query.eq('category_id', category)
  }

  if (status !== 'all') {
    if (status === 'in_stock') {
      query = query.gt('stock_quantity', 0)
    } else if (status === 'out_of_stock') {
      query = query.lte('stock_quantity', 0)
    }
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)

  if (error) {
    console.error('Fetch Products Action Error:', error)
    return { data: [], count: 0, error: error.message }
  }

  return { data, count: count ?? 0, error: null }
}
