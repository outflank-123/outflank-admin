'use client'

import { useState, useTransition } from 'react'
import { Plus, Edit2, Trash2, Search, Tag, X } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

const DynamicIcon = ({ name, size = 24, className = '' }: { name?: string | null, size?: number, className?: string }) => {
  if (!name) return <Tag size={size} className={className} />
  // Simple attempt to convert name to PascalCase if needed, but assuming user enters it correctly like "Leaf"
  const IconComponent = (LucideIcons as any)[name] || Tag
  return <IconComponent size={size} className={className} />
}
import { createCategory, updateCategory, deleteCategory } from '../actions'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon_name: string | null
  sort_order: number
}

export default function CategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const [categories] = useState<Category[]>(initialCategories)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon_name: '',
    sort_order: 0,
  })

  const openAddModal = () => {
    setEditingCat(null)
    setFormData({ name: '', slug: '', description: '', icon_name: '', sort_order: categories.length + 1 })
    setIsModalOpen(true)
  }

  const openEditModal = (cat: Category) => {
    setEditingCat(cat)
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      icon_name: cat.icon_name || '',
      sort_order: cat.sort_order,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        if (editingCat) {
          await updateCategory(editingCat.id, formData)
        } else {
          await createCategory(formData)
        }
        setIsModalOpen(false)
      } catch (err) {
        alert('Failed to save category')
        console.error(err)
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Products in this category will be uncategorized.')) return
    startTransition(async () => {
      try {
        await deleteCategory(id)
      } catch (err) {
        alert('Failed to delete category')
        console.error(err)
      }
    })
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  const filtered = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* Header Actions */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] p-2.5 flex items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[12px] border border-transparent bg-white shadow-sm text-[13px] focus:outline-none focus:border-[#e3231c]/30 focus:ring-4 focus:ring-[#e3231c]/5 transition-all placeholder:text-[#86868b]"
          />
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-black text-white px-4 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all shadow-md shadow-black/10"
        >
          <Plus size={14} /> Add Category
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] overflow-hidden p-6 md:p-8">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-white rounded-[24px] shadow-sm flex items-center justify-center mx-auto mb-6 text-[#86868b] border border-black/5">
              <Tag size={32} />
            </div>
            <h3 className="text-xl text-[#1d1d1f] font-bold tracking-tight mb-2">No categories found</h3>
            <p className="text-[#86868b]">Create your first category to organize products.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filtered.map((cat) => (
              <div key={cat.id} className="group relative rounded-[28px] overflow-hidden bg-white shadow-sm border border-black/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col h-[220px]">
                
                {/* Background Icon Watermark */}
                <div className="absolute -bottom-6 -right-6 text-black/[0.02] transform group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500 pointer-events-none">
                  <DynamicIcon name={cat.icon_name} size={140} />
                </div>

                <div className="relative flex-1 flex flex-col">
                  {/* Header: Icon & Sort Order */}
                  <div className="flex items-start justify-between mb-auto">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-black/[0.02] to-black/[0.06] border border-black/5 flex items-center justify-center text-[#1d1d1f] shadow-inner">
                      <DynamicIcon name={cat.icon_name} size={20} className="opacity-80" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-black/5 text-[10px] font-bold text-[#86868b] uppercase tracking-wider">
                      Order: {cat.sort_order}
                    </span>
                  </div>

                  {/* Title & Slug */}
                  <div className="mt-4">
                    <h3 className="text-[18px] font-bold text-[#1d1d1f] leading-tight mb-1 truncate">{cat.name}</h3>
                    <p className="text-[13px] text-[#86868b] font-medium truncate">/{cat.slug}</p>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4">
                  <button
                    onClick={() => openEditModal(cat)}
                    disabled={isPending}
                    className="w-12 h-12 rounded-full bg-white border border-black/10 flex items-center justify-center text-[#1d1d1f] hover:bg-[#1d1d1f] hover:text-white hover:border-[#1d1d1f] hover:scale-110 transition-all shadow-lg"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    disabled={isPending}
                    className="w-12 h-12 rounded-full bg-white border border-red-200 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 hover:scale-110 transition-all shadow-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* macOS Style Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white/90 backdrop-blur-3xl w-full max-w-lg flex flex-col rounded-[32px] shadow-2xl border border-white/50 overflow-hidden animate-in zoom-in-95 duration-300">
            
            <div className="px-8 py-6 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-white/50">
              <h2 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">{editingCat ? 'Edit Category' : 'Create Category'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#86868b] hover:bg-black/10 hover:text-black transition-colors">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[70vh]">
              <form id="category-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                
                <div>
                  <label className="block text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">Category Name</label>
                  <input
                    type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) })}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-black/10 text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all shadow-sm"
                    placeholder="e.g. Premium Corporate Gifts"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">URL Slug</label>
                  <input
                    type="text" required value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-black/[0.02] border border-black/5 text-[15px] font-medium text-[#86868b] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 transition-all"
                    placeholder="premium-corporate-gifts"
                  />
                  <p className="mt-2 text-[12px] font-medium text-[#86868b]">This will be used in the URL: /products/category/<span className="text-[#1d1d1f]">{formData.slug || 'slug'}</span></p>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-black/10 text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all shadow-sm min-h-[120px] resize-none"
                    placeholder="Briefly describe what this category contains..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">Icon Name</label>
                    <div className="relative">
                      <input
                        type="text" value={formData.icon_name}
                        onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-black/10 text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all shadow-sm"
                        placeholder="e.g. Package"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b]">
                        <DynamicIcon name={formData.icon_name} size={18} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">Sort Order</label>
                    <input
                      type="number" required value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-5 py-4 rounded-2xl bg-white border border-black/10 text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all shadow-sm"
                    />
                  </div>
                </div>

              </form>
            </div>
            
            <div className="px-8 py-6 border-t border-black/[0.05] bg-white/80 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3.5 rounded-2xl text-[15px] font-bold text-[#86868b] hover:bg-black/5 hover:text-[#1d1d1f] transition-colors">
                Cancel
              </button>
              <button type="submit" form="category-form" disabled={isPending} className="px-8 py-3.5 rounded-2xl text-[15px] font-bold bg-[#e3231c] text-white hover:bg-[#c91d17] hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none">
                {isPending ? 'Saving...' : 'Publish Category'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
