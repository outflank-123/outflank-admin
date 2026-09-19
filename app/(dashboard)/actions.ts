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

function sanitizeProductPayload(data: any, isPartial = false) {
  const payload: Record<string, any> = {}

  if (!isPartial) {
    if (!data?.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('Product name is required.')
    }
    if (!data?.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
      throw new Error('Product slug is required.')
    }
  }

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('Product name cannot be empty.')
    }
    payload.name = data.name.trim()
  }

  if (data.slug !== undefined) {
    if (typeof data.slug !== 'string' || !data.slug.trim()) {
      throw new Error('Product slug cannot be empty.')
    }
    payload.slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-')
  }

  if (data.category_id !== undefined) {
    payload.category_id = data.category_id || null
  }

  if (data.description !== undefined) {
    payload.description = typeof data.description === 'string' ? data.description.trim() : null
  }

  if (data.short_desc !== undefined) {
    payload.short_desc = typeof data.short_desc === 'string' ? data.short_desc.trim() : null
  }

  if (data.base_price !== undefined) {
    const basePrice = data.base_price !== null && data.base_price !== '' ? Number(data.base_price) : null
    payload.base_price = isNaN(basePrice as number) ? null : basePrice
  }

  if (data.min_order_qty !== undefined) {
    const minOrderQty = Number(data.min_order_qty)
    payload.min_order_qty = !isNaN(minOrderQty) ? Math.max(1, Math.round(minOrderQty)) : 50
  }

  if (data.lead_time_days !== undefined) {
    const leadTimeDays = Number(data.lead_time_days)
    payload.lead_time_days = !isNaN(leadTimeDays) ? Math.max(1, Math.round(leadTimeDays)) : 15
  }

  if (data.is_featured !== undefined) {
    payload.is_featured = Boolean(data.is_featured)
  }

  if (data.is_active !== undefined) {
    payload.is_active = Boolean(data.is_active)
  }

  if (data.is_retail !== undefined) {
    payload.is_retail = Boolean(data.is_retail)
  }

  if (data.is_customizable !== undefined) {
    payload.is_customizable = Boolean(data.is_customizable)
  }

  if (data.tags !== undefined) {
    payload.tags = Array.isArray(data.tags) ? data.tags.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => t.trim()) : []
  }

  if (data.color_variants !== undefined) {
    payload.color_variants = Array.isArray(data.color_variants) ? data.color_variants : []
  }

  if (data.primary_image_url !== undefined) {
    payload.primary_image_url = typeof data.primary_image_url === 'string' && data.primary_image_url.trim() ? data.primary_image_url.trim() : null
  }

  if (data.image_gallery !== undefined) {
    payload.image_gallery = Array.isArray(data.image_gallery) ? data.image_gallery : []
  }

  if (data.source_pdf !== undefined) {
    payload.source_pdf = typeof data.source_pdf === 'string' && data.source_pdf.trim() ? data.source_pdf.trim() : null
  }

  if (data.branding_config !== undefined) {
    payload.branding_config = data.branding_config && typeof data.branding_config === 'object' ? data.branding_config : null
  }

  return payload
}

export async function createProduct(rawData: any) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin', 'junior'])
  const payload = sanitizeProductPayload(rawData, false)

  let insertData = { ...payload }
  let { data, error } = await supabase.from('products').insert([insertData]).select().single()

  // If database table column is_retail has not been created yet in Supabase (error 42703)
  if (error && (error.code === '42703' || error.message?.includes('is_retail'))) {
    console.warn('[createProduct] is_retail column not found in DB. Saving fallback inside branding_config.')
    const { is_retail: _, ...payloadWithoutRetail } = insertData
    const existingConfig = (payloadWithoutRetail.branding_config && typeof payloadWithoutRetail.branding_config === 'object') ? payloadWithoutRetail.branding_config : {}
    payloadWithoutRetail.branding_config = { ...existingConfig, _is_retail: payload.is_retail }
    const retry = await supabase.from('products').insert([payloadWithoutRetail]).select().single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('[createProduct] DB Error:', error)
    throw new Error(error.message || 'Failed to create product.')
  }

  revalidatePath('/products')
  revalidatePath('/')
  return { success: true, product: data }
}

export async function updateProduct(id: string, rawData: any) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin', 'junior'])
  if (!id || typeof id !== 'string') throw new Error('Valid product ID required.')

  // If name and slug are not both provided, treat as partial update
  const isPartial = !(rawData?.name && rawData?.slug)
  const payload = sanitizeProductPayload(rawData, isPartial)

  let updateData = { ...payload }
  let { data, error } = await supabase.from('products').update(updateData).eq('id', id).select().single()

  // Fallback if column is_retail does not exist in DB yet
  if (error && (error.code === '42703' || error.message?.includes('is_retail'))) {
    console.warn('[updateProduct] is_retail column not found in DB. Storing fallback inside branding_config.')
    const { is_retail: _, ...payloadWithoutRetail } = updateData
    if (payload.is_retail !== undefined) {
      const { data: current } = await supabase.from('products').select('branding_config').eq('id', id).single()
      const currentConfig = (current?.branding_config && typeof current.branding_config === 'object') ? current.branding_config : {}
      payloadWithoutRetail.branding_config = { ...currentConfig, ...(payloadWithoutRetail.branding_config || {}), _is_retail: payload.is_retail }
    }
    const retry = await supabase.from('products').update(payloadWithoutRetail).eq('id', id).select().single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('[updateProduct] DB Error:', error)
    throw new Error(error.message || 'Failed to update product.')
  }

  revalidatePath('/products')
  if (data?.slug) revalidatePath(`/products/${data.slug}`)
  revalidatePath('/')
  return { success: true, product: data }
}

export async function batchUpdateProducts(updates: Array<{ id: string; changes: any }>) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin', 'junior'])
  if (!Array.isArray(updates) || updates.length === 0) {
    return { success: true, count: 0 }
  }

  const errors: string[] = []
  let updatedCount = 0

  await Promise.all(
    updates.map(async ({ id, changes }) => {
      try {
        const payload = sanitizeProductPayload(changes, true)
        let { error } = await supabase.from('products').update(payload).eq('id', id)
        if (error && (error.code === '42703' || error.message?.includes('is_retail'))) {
          const { is_retail, ...fallbackPayload } = payload
          if (is_retail !== undefined) {
            const { data: current } = await supabase.from('products').select('branding_config').eq('id', id).single()
            const currentConfig = (current?.branding_config && typeof current.branding_config === 'object') ? current.branding_config : {}
            fallbackPayload.branding_config = { ...currentConfig, ...(fallbackPayload.branding_config || {}), _is_retail: is_retail }
          }
          const retry = await supabase.from('products').update(fallbackPayload).eq('id', id)
          error = retry.error
        }
        if (error) {
          errors.push(`ID ${id}: ${error.message}`)
        } else {
          updatedCount++
        }
      } catch (err: any) {
        errors.push(`ID ${id}: ${err.message || 'Unknown error'}`)
      }
    })
  )

  if (errors.length > 0) {
    console.error('[batchUpdateProducts] Errors:', errors)
  }

  revalidatePath('/products')
  revalidatePath('/')
  return { success: errors.length === 0, count: updatedCount, errors }
}

export async function duplicateProduct(id: string) {
  const { supabase } = await requireAuthUser(['super_admin', 'admin', 'junior'])
  if (!id || typeof id !== 'string') throw new Error('Valid product ID required.')

  const { data: original, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) {
    throw new Error('Product to duplicate not found.')
  }

  const { id: _, created_at: __, updated_at: ___, ...rest } = original

  const randomSuffix = Math.random().toString(36).substring(2, 7)
  const clonedPayload = {
    ...rest,
    name: `${original.name} (Copy)`,
    slug: `${original.slug}-copy-${randomSuffix}`,
    is_active: false, // Default duplicated item to draft
  }

  const { data: newProduct, error: insertError } = await supabase
    .from('products')
    .insert([clonedPayload])
    .select()
    .single()

  if (insertError) {
    console.error('[duplicateProduct] DB Error:', insertError)
    throw new Error(insertError.message || 'Failed to duplicate product.')
  }

  revalidatePath('/products')
  revalidatePath('/')
  return { success: true, product: newProduct }
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
