'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'

type AdminRole = 'super_admin' | 'admin' | 'junior'

/**
 * Server-side session and role authorization guard.
 * Validates the authenticated user session and role against allowed roles.
 */
async function requireAuthUser(allowedRoles: AdminRole[]) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized: Authentication required.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('Unauthorized: User profile not found.')
  }

  const role = profile.role as AdminRole
  if (!allowedRoles.includes(role)) {
    throw new Error('Forbidden: Insufficient permissions for this action.')
  }

  return { supabase, user, role }
}

// ─────────────────────────────────────────────────────────────
// --- CATEGORIES (super_admin, admin) ---
// ─────────────────────────────────────────────────────────────

interface CategoryInput {
  name: string
  slug: string
  description?: string | null
  icon_name?: string | null
  sort_order?: number
}

function sanitizeCategoryPayload(data: any) {
  if (!data?.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('Category name is required.')
  }
  if (!data?.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
    throw new Error('Category slug is required.')
  }

  return {
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
    description: typeof data.description === 'string' ? data.description.trim() : null,
    icon_name: typeof data.icon_name === 'string' ? data.icon_name.trim() : null,
    sort_order: Number.isInteger(Number(data.sort_order)) ? Number(data.sort_order) : 0,
  }
}

export async function createCategory(rawData: any) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin'])
  const payload = sanitizeCategoryPayload(rawData)

  const { error } = await supabase.from('categories').insert([payload])
  if (error) {
    console.error('[createCategory] DB Error:', error)
    throw new Error(error.message || 'Failed to create category.')
  }

  revalidatePath('/categories')
  revalidatePath('/products')
  return { success: true }
}

export async function updateCategory(id: string, rawData: any) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin'])
  if (!id || typeof id !== 'string') throw new Error('Valid category ID required.')

  const payload = sanitizeCategoryPayload(rawData)

  const { error } = await supabase.from('categories').update(payload).eq('id', id)
  if (error) {
    console.error('[updateCategory] DB Error:', error)
    throw new Error(error.message || 'Failed to update category.')
  }

  revalidatePath('/categories')
  revalidatePath('/products')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin'])
  if (!id || typeof id !== 'string') throw new Error('Valid category ID required.')

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) {
    console.error('[deleteCategory] DB Error:', error)
    throw new Error(error.message || 'Failed to delete category.')
  }

  revalidatePath('/categories')
  revalidatePath('/products')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// --- PRODUCTS (super_admin, admin, junior) ---
// ─────────────────────────────────────────────────────────────

function sanitizeProductPayload(data: any) {
  if (!data?.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('Product name is required.')
  }
  if (!data?.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
    throw new Error('Product slug is required.')
  }

  const basePrice = data.base_price !== null && data.base_price !== undefined && data.base_price !== ''
    ? Number(data.base_price)
    : null

  const minOrderQty = Number.isInteger(Number(data.min_order_qty))
    ? Math.max(1, Number(data.min_order_qty))
    : 50

  const leadTimeDays = Number.isInteger(Number(data.lead_time_days))
    ? Math.max(1, Number(data.lead_time_days))
    : 15

  return {
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
    category_id: data.category_id || null,
    description: typeof data.description === 'string' ? data.description.trim() : null,
    short_desc: typeof data.short_desc === 'string' ? data.short_desc.trim() : null,
    base_price: isNaN(basePrice as number) ? null : basePrice,
    min_order_qty: minOrderQty,
    lead_time_days: leadTimeDays,
    is_featured: Boolean(data.is_featured),
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
    is_customizable: Boolean(data.is_customizable),
    tags: Array.isArray(data.tags) ? data.tags : [],
    color_variants: Array.isArray(data.color_variants) ? data.color_variants : [],
    primary_image_url: typeof data.primary_image_url === 'string' ? data.primary_image_url : null,
    image_gallery: Array.isArray(data.image_gallery) ? data.image_gallery : [],
    branding_config: data.branding_config && typeof data.branding_config === 'object' ? data.branding_config : null,
  }
}

export async function createProduct(rawData: any) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin', 'junior'])
  const payload = sanitizeProductPayload(rawData)

  const { error } = await supabase.from('products').insert([payload])
  if (error) {
    console.error('[createProduct] DB Error:', error)
    throw new Error(error.message || 'Failed to create product.')
  }

  revalidatePath('/products')
  revalidatePath('/products')
  revalidatePath('/')
  return { success: true }
}

export async function updateProduct(id: string, rawData: any) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin', 'junior'])
  if (!id || typeof id !== 'string') throw new Error('Valid product ID required.')

  const payload = sanitizeProductPayload(rawData)

  const { error } = await supabase.from('products').update(payload).eq('id', id)
  if (error) {
    console.error('[updateProduct] DB Error:', error)
    throw new Error(error.message || 'Failed to update product.')
  }

  revalidatePath('/products')
  revalidatePath('/products')
  if (payload.slug) revalidatePath(`/products/${payload.slug}`)
  revalidatePath('/')
  return { success: true }
}

export async function deleteProduct(id: string) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin', 'junior'])
  if (!id || typeof id !== 'string') throw new Error('Valid product ID required.')

  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) {
    console.error('[deleteProduct] DB Error:', error)
    throw new Error(error.message || 'Failed to delete product.')
  }

  revalidatePath('/products')
  revalidatePath('/products')
  revalidatePath('/')
  return { success: true }
}

export async function uploadProductImage(formData: FormData) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin', 'junior'])

  const file = formData.get('file') as File
  if (!file) throw new Error('No file provided.')

  // Validate allowed file types
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WEBP, and SVG are supported.')
  }

  // Validate file size (max 5MB initial)
  const MAX_FILE_SIZE = 5 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds the 5MB limit.')
  }

  const bytes = await file.arrayBuffer()
  let buffer = Buffer.from(bytes)

  // Skip compression for SVG
  if (file.type !== 'image/svg+xml') {
    const targetBytes = 30 * 1024 // 30 KB
    let quality = 85
    let isUnderTarget = false
    
    // First, try adjusting quality while keeping original dimensions
    while (quality >= 30) {
      const tempBuffer = await sharp(buffer)
        .webp({ quality })
        .toBuffer()
      
      if (tempBuffer.length <= targetBytes) {
        buffer = tempBuffer
        isUnderTarget = true
        break
      }
      quality -= 5
    }

    // If still over 30KB, try scaling down resolution iteratively
    if (!isUnderTarget) {
      let scale = 0.85
      const metadata = await sharp(buffer).metadata()
      const originalWidth = metadata.width || 800
      
      while (!isUnderTarget) {
        const targetWidth = Math.max(Math.round(originalWidth * scale), 100) // prevent getting too small
        const tempBuffer = await sharp(buffer)
          .resize({ width: targetWidth })
          .webp({ quality: 50 })
          .toBuffer()
          
        if (tempBuffer.length <= targetBytes || targetWidth <= 100) {
          buffer = tempBuffer
          isUnderTarget = true
          break
        }
        scale *= 0.85
      }
    }
  }

  const ext = file.type === 'image/svg+xml' ? 'svg' : 'webp'
  const contentType = file.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/webp'
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(fileName, buffer, {
      contentType: contentType,
      upsert: false,
    })

  if (error) {
    console.error('[uploadProductImage] Storage Error:', error)
    throw new Error(error.message || 'Failed to upload image.')
  }

  const { data: publicUrlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(data.path)

  return publicUrlData.publicUrl
}

// ─────────────────────────────────────────────────────────────
// --- BANNERS (super_admin, admin) ---
// ─────────────────────────────────────────────────────────────

function sanitizeBannerPayload(data: any) {
  if (!data?.title || typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error('Banner title is required.')
  }
  if (!data?.image_url || typeof data.image_url !== 'string' || !data.image_url.trim()) {
    throw new Error('Banner image URL is required.')
  }

  return {
    title: data.title.trim(),
    image_url: data.image_url.trim(),
    cta_text: typeof data.cta_text === 'string' ? data.cta_text.trim() : null,
    cta_link: typeof data.cta_link === 'string' ? data.cta_link.trim() : null,
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
    sort_order: Number.isInteger(Number(data.sort_order)) ? Number(data.sort_order) : 0,
  }
}

export async function createBanner(rawData: any) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin'])
  const payload = sanitizeBannerPayload(rawData)

  const { error } = await supabase.from('banners').insert([payload])
  if (error) {
    console.error('[createBanner] DB Error:', error)
    throw new Error(error.message || 'Failed to create banner.')
  }

  revalidatePath('/banners')
  revalidatePath('/')
  return { success: true }
}

export async function updateBanner(id: string, rawData: any) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin'])
  if (!id || typeof id !== 'string') throw new Error('Valid banner ID required.')

  const payload = sanitizeBannerPayload(rawData)

  const { error } = await supabase.from('banners').update(payload).eq('id', id)
  if (error) {
    console.error('[updateBanner] DB Error:', error)
    throw new Error(error.message || 'Failed to update banner.')
  }

  revalidatePath('/banners')
  revalidatePath('/')
  return { success: true }
}

export async function deleteBanner(id: string) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin'])
  if (!id || typeof id !== 'string') throw new Error('Valid banner ID required.')

  const { error } = await supabase.from('banners').delete().eq('id', id)
  if (error) {
    console.error('[deleteBanner] DB Error:', error)
    throw new Error(error.message || 'Failed to delete banner.')
  }

  revalidatePath('/banners')
  revalidatePath('/')
  return { success: true }
}
