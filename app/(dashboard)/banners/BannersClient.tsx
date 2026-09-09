'use client'

import { useState, useTransition } from 'react'
import { Plus, Edit2, Trash2, Image as ImageIcon, X, Loader2, Link as LinkIcon, MoveUp, MoveDown } from 'lucide-react'
import { createBanner, updateBanner, deleteBanner, uploadProductImage } from '../actions'
import Image from 'next/image'

interface Banner {
  id: string
  title: string
  image_url: string
  cta_text: string | null
  cta_link: string | null
  is_active: boolean
  sort_order: number
}

export default function BannersClient({ initialBanners }: { initialBanners: Banner[] }) {
  const [banners, setBanners] = useState<Banner[]>(initialBanners)
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [uploading, setUploading] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    cta_text: '',
    cta_link: '',
    is_active: true,
    sort_order: 0
  })

  const openAddModal = () => {
    setEditingBanner(null)
    setFormData({
      title: '', image_url: '', cta_text: '', cta_link: '', is_active: true, sort_order: banners.length * 10
    })
    setIsModalOpen(true)
  }

  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner)
    setFormData({
      title: banner.title,
      image_url: banner.image_url,
      cta_text: banner.cta_text || '',
      cta_link: banner.cta_link || '',
      is_active: banner.is_active,
      sort_order: banner.sort_order
    })
    setIsModalOpen(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setUploading(true)
    try {
      const data = new FormData()
      data.append('file', e.target.files[0])
      // Reusing uploadProductImage since it uploads to 'product-images' bucket which works for banners too
      const url = await uploadProductImage(data)
      setFormData(prev => ({ ...prev, image_url: url }))
    } catch (err) {
      alert('Failed to upload image. Make sure your bucket allows uploads.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.image_url) return alert('Please upload a banner image.')

    startTransition(async () => {
      try {
        const payload = {
          title: formData.title,
          image_url: formData.image_url,
          cta_text: formData.cta_text || null,
          cta_link: formData.cta_link || null,
          is_active: formData.is_active,
          sort_order: formData.sort_order
        }

        if (editingBanner) {
          await updateBanner(editingBanner.id, payload)
          setBanners(banners.map(b => b.id === editingBanner.id ? { ...b, ...payload } : b))
        } else {
          await createBanner(payload)
          window.location.reload() // Reload to get the new banner with ID
        }
        setIsModalOpen(false)
      } catch (err) {
        alert('Failed to save banner')
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return
    startTransition(async () => {
      try {
        await deleteBanner(id)
        setBanners(banners.filter(b => b.id !== id))
      } catch (err) {
        alert('Failed to delete banner')
      }
    })
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      try {
        await updateBanner(id, { is_active: !currentStatus })
        setBanners(banners.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b))
      } catch (err) {
        alert('Failed to update status')
      }
    })
  }

  const moveBanner = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === banners.length - 1)) return

    const newBanners = [...banners]
    const current = newBanners[index]
    const swapWith = newBanners[direction === 'up' ? index - 1 : index + 1]

    // Swap sort orders
    const currentSort = current.sort_order
    current.sort_order = swapWith.sort_order
    swapWith.sort_order = currentSort

    // Optimistic update
    newBanners[index] = swapWith
    newBanners[direction === 'up' ? index - 1 : index + 1] = current
    setBanners(newBanners)

    // Save to DB
    startTransition(async () => {
      await updateBanner(current.id, { sort_order: current.sort_order })
      await updateBanner(swapWith.id, { sort_order: swapWith.sort_order })
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-medium text-[#86868b]">Manage the main hero carousel sequence.</p>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#e3231c] hover:bg-[#c91d17] text-white px-5 py-3 rounded-full text-[14px] font-bold transition-all shadow-md shadow-[#e3231c]/20 hover:shadow-lg hover:-translate-y-0.5"
        >
          <Plus size={16} strokeWidth={2.5} /> Add Banner
        </button>
      </div>

      {/* Grid */}
      {banners.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-[32px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] text-center py-32">
          <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-6 text-[#86868b]">
            <ImageIcon size={32} />
          </div>
          <h3 className="text-xl text-[#1d1d1f] font-bold tracking-tight mb-2">No banners added</h3>
          <p className="text-[#86868b]">Upload your first banner to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {banners.map((banner, index) => (
            <div key={banner.id} className="group relative rounded-[32px] overflow-hidden bg-black/5 aspect-[21/9] sm:aspect-[16/7] md:aspect-[16/8] shadow-lg transition-transform hover:-translate-y-1 hover:shadow-2xl duration-500">
              
              {/* Background Image */}
              {banner.image_url ? (
                <Image src={banner.image_url} alt={banner.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" unoptimized />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon size={48} className="text-black/10" />
                </div>
              )}

              {/* Gradient Overlay for Text Readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

              {/* Top Controls: Status Toggle & Reorder Pill */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                {/* Status Toggle */}
                <button
                  onClick={() => toggleStatus(banner.id, banner.is_active)}
                  disabled={isPending}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md transition-all ${
                    banner.is_active ? 'bg-[#34c759]/20 text-[#34c759] border border-[#34c759]/30' : 'bg-black/40 text-white/70 border border-white/20'
                  }`}
                  title="Toggle visibility"
                >
                  <div className={`w-2 h-2 rounded-full ${banner.is_active ? 'bg-[#34c759] shadow-[0_0_8px_#34c759]' : 'bg-white/50'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">{banner.is_active ? 'Live' : 'Hidden'}</span>
                </button>

                {/* Reorder Pill */}
                <div className="flex items-center bg-black/40 backdrop-blur-md rounded-full border border-white/20 overflow-hidden shadow-lg">
                  <button 
                    onClick={() => moveBanner(index, 'up')} disabled={index === 0 || isPending}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    title="Move up"
                  >
                    <MoveUp size={16} />
                  </button>
                  <div className="w-[1px] h-4 bg-white/20" />
                  <button 
                    onClick={() => moveBanner(index, 'down')} disabled={index === banners.length - 1 || isPending}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    title="Move down"
                  >
                    <MoveDown size={16} />
                  </button>
                </div>
              </div>

              {/* Bottom Info & Action Buttons */}
              <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex items-end justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-bold text-white mb-2 truncate drop-shadow-md">{banner.title}</h3>
                  {banner.cta_text && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-semibold tracking-wide">
                      <LinkIcon size={12} />
                      {banner.cta_text}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEditModal(banner)} disabled={isPending} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/40 transition-colors shadow-lg">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(banner.id)} disabled={isPending} className="w-10 h-10 rounded-full bg-red-500/80 backdrop-blur-md border border-red-400 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Modern macOS Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white/90 backdrop-blur-3xl w-full max-w-2xl flex flex-col rounded-[32px] shadow-2xl border border-white/50 overflow-hidden animate-in zoom-in-95 duration-300">
            
            <div className="px-8 py-6 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-white/50">
              <h2 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">{editingBanner ? 'Edit Banner' : 'Upload New Banner'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#86868b] hover:bg-black/10 hover:text-black transition-colors">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[70vh]">
              <form id="banner-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                
                {/* Massive Image Dropzone */}
                <div>
                  <label className="block text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">Banner Artwork</label>
                  <div className="relative h-64 bg-black/[0.03] border-2 border-dashed border-black/10 rounded-[24px] flex flex-col items-center justify-center hover:bg-black/[0.05] hover:border-[#e3231c]/50 transition-all overflow-hidden group">
                    <input 
                      type="file" accept="image/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    {uploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-[#e3231c]" size={32} />
                        <span className="text-sm font-semibold text-[#86868b]">Uploading high-res artwork...</span>
                      </div>
                    ) : formData.image_url ? (
                      <>
                        <Image src={formData.image_url} alt="Banner Preview" fill className="object-cover" unoptimized />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-white text-black px-4 py-2 rounded-full font-bold text-sm shadow-xl">Click to Change Image</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-center px-6">
                        <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4 text-[#e3231c]">
                          <ImageIcon size={32} />
                        </div>
                        <span className="text-[15px] font-bold text-[#1d1d1f] mb-1">Drag and drop or click to upload</span>
                        <span className="text-[13px] font-medium text-[#86868b]">16:9 Landscape aspect ratio recommended</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">Internal Title</label>
                  <input
                    type="text" required value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-black/10 text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all shadow-sm"
                    placeholder="e.g. Diwali Corporate Special 2026"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">CTA Text</label>
                    <input
                      type="text" value={formData.cta_text}
                      onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-white border border-black/10 text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all shadow-sm"
                      placeholder="e.g. Explore Gifts"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">CTA Link</label>
                    <input
                      type="text" value={formData.cta_link}
                      onChange={(e) => setFormData({ ...formData, cta_link: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-white border border-black/10 text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all shadow-sm"
                      placeholder="e.g. /products?category=gift-sets"
                    />
                  </div>
                </div>

              </form>
            </div>
            
            <div className="px-8 py-6 border-t border-black/[0.05] bg-white/80 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3.5 rounded-2xl text-[15px] font-bold text-[#86868b] hover:bg-black/5 hover:text-[#1d1d1f] transition-colors">
                Cancel
              </button>
              <button type="submit" form="banner-form" disabled={isPending || uploading} className="px-8 py-3.5 rounded-2xl text-[15px] font-bold bg-[#e3231c] text-white hover:bg-[#c91d17] hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none">
                {isPending ? 'Saving...' : 'Publish Banner'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
