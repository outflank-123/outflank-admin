'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Edit2, Trash2, Search, Package, X, Image as ImageIcon, UploadCloud, Loader2 } from 'lucide-react'
import { createProduct, updateProduct, deleteProduct, uploadProductImage } from '../actions'
import Image from 'next/image'

export interface ColorVariant {
  name: string
  hex: string
  images: string[]
}

interface Product {
  id: string
  category_id: string | null
  name: string
  slug: string
  description: string | null
  short_desc: string | null
  base_price: number | null
  min_order_qty: number
  is_featured: boolean
  is_active: boolean
  is_customizable: boolean
  branding_config: { top: string, left: string, transform: string, width: string } | null
  color_variants: ColorVariant[]
  primary_image_url: string | null
  image_gallery: string[] | null
  categories?: { name: string } | null
}

interface ProductsClientProps {
  initialProducts: Product[]
  categories: { id: string; name: string }[]
}

export default function ProductsClient({ initialProducts, categories }: ProductsClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isPending, startTransition] = useTransition()
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category_id: '',
    description: '',
    short_desc: '',
    base_price: '',
    min_order_qty: 50,
    is_featured: false,
    is_active: true,
    is_customizable: false,
    branding_config_top: '50%',
    branding_config_left: '50%',
    branding_config_transform: 'translate(-50%, -50%)',
    branding_config_width: '40%',
    color_variants: [] as ColorVariant[],
    primary_image_url: '',
    image_gallery: [] as string[],
  })

  const [uploadingState, setUploadingState] = useState<'gallery' | number | null>(null)

  const openAddModal = () => {
    setEditingProduct(null)
    setFormData({
      name: '', slug: '', category_id: categories[0]?.id || '', description: '', 
      short_desc: '', base_price: '', min_order_qty: 50, is_featured: false, 
      is_active: true, is_customizable: false, 
      branding_config_top: '50%', branding_config_left: '50%', 
      branding_config_transform: 'translate(-50%, -50%)', branding_config_width: '40%',
      color_variants: [],
      primary_image_url: '',
      image_gallery: []
    })
    setIsModalOpen(true)
  }

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod)
    setFormData({
      name: prod.name,
      slug: prod.slug,
      category_id: prod.category_id || '',
      description: prod.description || '',
      short_desc: prod.short_desc || '',
      base_price: prod.base_price?.toString() || '',
      min_order_qty: prod.min_order_qty || 50,
      is_featured: prod.is_featured,
      is_active: prod.is_active,
      is_customizable: prod.is_customizable || false,
      branding_config_top: prod.branding_config?.top || '50%',
      branding_config_left: prod.branding_config?.left || '50%',
      branding_config_transform: prod.branding_config?.transform || 'translate(-50%, -50%)',
      branding_config_width: prod.branding_config?.width || '40%',
      color_variants: prod.color_variants || [],
      primary_image_url: prod.primary_image_url || '',
      image_gallery: prod.image_gallery || (prod.primary_image_url ? [prod.primary_image_url] : []),
    })
    setIsModalOpen(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'gallery' | number) => {
    if (!e.target.files?.length) return
    setUploadingState(target)
    try {
      const newUrls: string[] = []
      for (const file of Array.from(e.target.files)) {
        const data = new FormData()
        data.append('file', file)
        const url = await uploadProductImage(data)
        newUrls.push(url)
      }

      if (target === 'gallery') {
        setFormData(prev => ({ 
          ...prev, 
          image_gallery: [...(prev.image_gallery || []), ...newUrls],
          primary_image_url: prev.primary_image_url || newUrls[0] 
        }))
      } else {
        const newVariants = [...formData.color_variants]
        newVariants[target].images = [...(newVariants[target].images || []), ...newUrls]
        setFormData(prev => ({ ...prev, color_variants: newVariants }))
      }
    } catch (err) {
      alert('Failed to upload image. Make sure your bucket allows uploads.')
      console.error(err)
    } finally {
      setUploadingState(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const payload = {
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          short_desc: formData.short_desc,
          min_order_qty: formData.min_order_qty,
          is_featured: formData.is_featured,
          is_active: formData.is_active,
          primary_image_url: formData.image_gallery[0] || formData.primary_image_url,
          image_gallery: formData.image_gallery,
          is_customizable: formData.is_customizable,
          branding_config: formData.is_customizable ? {
            top: formData.branding_config_top,
            left: formData.branding_config_left,
            transform: formData.branding_config_transform,
            width: formData.branding_config_width
          } : null,
          color_variants: formData.color_variants,
          base_price: formData.base_price ? parseFloat(formData.base_price) : null,
          category_id: formData.category_id || null
        }
        if (editingProduct) {
          await updateProduct(editingProduct.id, payload)
        } else {
          await createProduct(payload)
        }
        setIsModalOpen(false)
        window.location.reload() // Refresh to get joined data
      } catch (err) {
        alert('Failed to save product')
        console.error(err)
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    startTransition(async () => {
      try {
        await deleteProduct(id)
        setProducts(products.filter(p => p.id !== id))
      } catch (err) {
        alert('Failed to delete product')
      }
    })
  }

  const toggleStatus = async (id: string, field: 'is_active' | 'is_featured', currentValue: boolean) => {
    startTransition(async () => {
      try {
        await updateProduct(id, { [field]: !currentValue })
        setProducts(products.map(p => p.id === id ? { ...p, [field]: !currentValue } : p))
      } catch (err) {
        alert(`Failed to update ${field}`)
      }
    })
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  const filtered = products.filter((p) => {
    const matchesSearch = search.trim() ? p.name.toLowerCase().includes(search.toLowerCase()) || p.categories?.name?.toLowerCase().includes(search.toLowerCase()) : true
    const matchesCategory = selectedCategory === 'all' ? true : p.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* Header Actions */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] p-2.5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2.5 rounded-[12px] border border-transparent bg-white shadow-sm text-[13px] focus:outline-none focus:border-[#e3231c]/30 focus:ring-4 focus:ring-[#e3231c]/5 transition-all placeholder:text-[#86868b]"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 rounded-[12px] border border-transparent bg-white shadow-sm text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:border-[#e3231c]/30 focus:ring-4 focus:ring-[#e3231c]/5 transition-all cursor-pointer min-w-[160px] max-w-xs truncate"
          >
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-black text-white px-4 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all shadow-md shadow-black/10 shrink-0"
        >
          <Plus size={14} /> Add Product
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] overflow-hidden p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 text-[#86868b]">
              <Package size={24} />
            </div>
            <p className="text-[#1d1d1f] font-semibold">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((prod) => (
              <div key={prod.id} className="group relative rounded-[24px] overflow-hidden bg-white shadow-sm border border-black/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-[340px]">
                
                {/* Image Section */}
                <div className="relative h-2/3 w-full bg-black/5 overflow-hidden">
                  {prod.primary_image_url ? (
                    <Image src={prod.primary_image_url} alt={prod.name} fill className="object-cover transition-transform duration-500 group-hover:scale-110" unoptimized />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon size={32} className="text-black/10" />
                    </div>
                  )}
                  
                  {/* Status Badges Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-2 pointer-events-none">
                    {prod.is_featured && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-500/90 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                        Featured
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                      prod.is_active ? 'bg-[#34c759]/90 text-white' : 'bg-black/60 text-white/80'
                    }`}>
                      {prod.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 p-5 flex flex-col justify-between bg-white relative">
                  {/* Category Pill (floating slightly over image boundary) */}
                  <div className="absolute -top-4 left-5 right-5 flex justify-center pointer-events-none">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-black/10 text-[11px] font-bold text-[#1d1d1f]/70 uppercase tracking-widest shadow-sm truncate max-w-full">
                      {prod.categories?.name ?? 'Uncategorized'}
                    </span>
                  </div>

                  <div className="mt-2 text-center">
                    <h3 className="text-[16px] font-bold text-[#1d1d1f] truncate leading-tight" title={prod.name}>{prod.name}</h3>
                    {prod.base_price && (
                      <p className="text-[14px] font-semibold text-[#e3231c] mt-1">₹{prod.base_price}</p>
                    )}
                  </div>

                  {/* Actions (appear on hover) */}
                  <div className="absolute bottom-4 left-0 w-full flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onClick={() => openEditModal(prod)} disabled={isPending} className="w-10 h-10 rounded-full bg-white border border-black/10 flex items-center justify-center text-[#86868b] hover:bg-[#1d1d1f] hover:text-white hover:border-[#1d1d1f] transition-all shadow-lg hover:scale-110">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(prod.id)} disabled={isPending} className="w-10 h-10 rounded-full bg-white border border-red-200 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg hover:scale-110">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/80 backdrop-blur-2xl w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[32px] shadow-2xl border border-white overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-black/[0.03] flex items-center justify-between shrink-0">
              <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#86868b] hover:bg-black/10 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 min-h-0">
              <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-5 pb-4">
                
                {/* Image Gallery Upload Zone */}
                <div>
                  <label className="block text-[12px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Product Gallery</label>
                  <div className="bg-black/5 border-2 border-dashed border-black/10 rounded-2xl p-6 transition-all hover:bg-black/[0.07] hover:border-black/20 flex flex-col items-center justify-center relative min-h-[140px]">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'gallery')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    {uploadingState === 'gallery' ? (
                      <div className="flex flex-col items-center text-[#e3231c]">
                        <Loader2 className="animate-spin mb-2" size={24} />
                        <p className="text-[13px] font-semibold">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={32} className="text-[#86868b] mb-3" />
                        <p className="text-[14px] font-semibold text-[#1d1d1f]">Click or drag images here</p>
                        <p className="text-[12px] text-[#86868b] mt-1">Supports PNG, JPG, WEBP</p>
                      </>
                    )}
                  </div>
                  {/* Thumbnails */}
                  {formData.image_gallery.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto mt-4 pb-2">
                      {formData.image_gallery.map((url, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-xl bg-white border border-black/10 overflow-hidden shrink-0 group">
                          <Image src={url} alt="" fill className="object-cover" unoptimized />
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({...prev, image_gallery: prev.image_gallery.filter((_, i) => i !== idx)}))}
                            className="absolute top-1 right-1 bg-white/90 rounded-full p-1 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Product Name</label>
                    <input
                      type="text" required value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) })}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-[14px] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Category</label>
                    <select
                      required value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-[14px] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all appearance-none"
                    >
                      <option value="">Select Category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Short Description</label>
                  <input
                    type="text" value={formData.short_desc}
                    onChange={(e) => setFormData({ ...formData, short_desc: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-[14px] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all"
                  />
                </div>

                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2 text-[14px] font-medium text-[#1d1d1f] cursor-pointer">
                    <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 rounded text-[#e3231c]" /> Active
                  </label>
                  <label className="flex items-center gap-2 text-[14px] font-medium text-[#1d1d1f] cursor-pointer">
                    <input type="checkbox" checked={formData.is_customizable} onChange={(e) => setFormData({ ...formData, is_customizable: e.target.checked })} className="w-4 h-4 rounded text-[#e3231c]" /> Customizable
                  </label>
                </div>

                {/* Color Variants Section */}
                <div className="bg-black/5 p-5 rounded-2xl border border-black/10 mt-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-bold text-[#1d1d1f] tracking-wide">Color Variants</h3>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color_variants: [...prev.color_variants, { name: '', hex: '#000000', images: [] }] }))}
                      className="text-[11px] font-semibold bg-white border border-black/10 px-3 py-1.5 rounded-lg hover:bg-black/5 transition-colors"
                    >
                      + Add Variant
                    </button>
                  </div>
                  
                  {formData.color_variants.map((variant, i) => (
                    <div key={i} className="flex flex-col gap-4 p-5 bg-white rounded-2xl border border-black/10 relative">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color_variants: prev.color_variants.filter((_, idx) => idx !== i) }))}
                        className="absolute top-3 right-3 p-1.5 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="grid grid-cols-2 gap-4 pr-8">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Color Name</label>
                          <input type="text" value={variant.name} onChange={(e) => {
                            const newVariants = [...formData.color_variants]; newVariants[i].name = e.target.value; setFormData({ ...formData, color_variants: newVariants })
                          }} className="w-full px-3 py-2 rounded-xl bg-[#f5f5f7] border-transparent text-[13px]" placeholder="e.g. Midnight" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Hex Code</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={variant.hex} onChange={(e) => {
                              const newVariants = [...formData.color_variants]; newVariants[i].hex = e.target.value; setFormData({ ...formData, color_variants: newVariants })
                            }} className="w-8 h-8 rounded cursor-pointer shrink-0" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Variant specific image upload */}
                      <div>
                        <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Variant Images</label>
                        <div className="bg-[#f5f5f7] rounded-xl p-4 flex flex-col items-center justify-center relative min-h-[100px] border border-black/5 hover:border-black/10 transition-colors">
                          <input 
                            type="file" multiple accept="image/*"
                            onChange={(e) => handleFileUpload(e, i)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          {uploadingState === i ? (
                            <Loader2 className="animate-spin text-[#e3231c]" size={20} />
                          ) : (
                            <p className="text-[12px] font-semibold text-[#1d1d1f]">Click or drag variant images here</p>
                          )}
                        </div>
                        {/* Variant Thumbnails */}
                        {variant.images && variant.images.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
                            {variant.images.map((url, idx) => (
                              <div key={idx} className="relative w-12 h-12 rounded-lg bg-white border border-black/10 overflow-hidden shrink-0 group">
                                <Image src={url} alt="" fill className="object-cover" unoptimized />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newVariants = [...formData.color_variants];
                                    newVariants[i].images = newVariants[i].images.filter((_, imgIdx) => imgIdx !== idx);
                                    setFormData({ ...formData, color_variants: newVariants });
                                  }}
                                  className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 text-red-600 opacity-0 group-hover:opacity-100"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </form>
            </div>
            
            <div className="px-8 py-5 border-t border-black/[0.03] bg-black/[0.01] flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl text-[14px] font-semibold text-[#86868b] hover:bg-black/5">Cancel</button>
              <button type="submit" form="product-form" disabled={isPending || uploadingState !== null} className="px-6 py-3 rounded-xl text-[14px] font-semibold bg-[#e3231c] text-white hover:bg-[#c91d17]">
                {isPending ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
