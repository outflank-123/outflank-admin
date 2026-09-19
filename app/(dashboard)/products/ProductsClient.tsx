'use client'

import { useState, useTransition, useId, useMemo, useEffect } from 'react'
import {
  Plus, Edit2, Edit3, Trash2, Search, Package, X, Image as ImageIcon,
  UploadCloud, Loader2, Copy, ExternalLink, Star, Check, LayoutGrid,
  List, Tag, SlidersHorizontal, ArrowUpDown, Palette, Paintbrush,
  DollarSign, Clock, ShieldAlert, Eye, RefreshCw, ChevronLeft,
  ChevronRight, ArrowUp, ArrowDown, CheckSquare, Square, MinusSquare,
  HelpCircle, Info, Filter, MoreHorizontal, Layers, ChevronDown,
  ShoppingBag, Users, Building2, Save, RotateCcw
} from 'lucide-react'
import { createProduct, updateProduct, deleteProduct, duplicateProduct, uploadProductImage, batchUpdateProducts } from '../actions'
import Image from 'next/image'
import BrandingCanvasEditor from './BrandingCanvasEditor'

export interface ColorVariant {
  name: string
  hex: string
  images: string[]
}

export interface BrandingConfig {
  top?: string
  left?: string
  width?: string
  transform?: string
  rotate?: number
}

export interface Product {
  id: string
  category_id: string | null
  name: string
  slug: string
  description: string | null
  short_desc: string | null
  base_price: number | null
  min_order_qty: number
  lead_time_days: number
  is_featured: boolean
  is_active: boolean
  is_customizable: boolean
  is_retail?: boolean
  tags: string[]
  color_variants: ColorVariant[]
  primary_image_url: string | null
  image_gallery: string[] | null
  source_pdf: string | null
  branding_config: BrandingConfig | null
  created_at?: string
  updated_at?: string
  categories?: { name: string } | null
}

interface ProductsClientProps {
  initialProducts: Product[]
  categories: { id: string; name: string }[]
}

type ModalTab = 'general' | 'pricing' | 'media' | 'variants' | 'branding'

const BRANDING_PRESETS = [
  { label: 'Left Chest (Standard Pocket)', top: '49%', left: '60%', width: '16%', transform: 'translate(-50%, -50%)' },
  { label: 'Right Chest', top: '49%', left: '40%', width: '16%', transform: 'translate(-50%, -50%)' },
  { label: 'Center Chest (Below Placket)', top: '57%', left: '50%', width: '22%', transform: 'translate(-50%, -50%)' },
  { label: 'Full Front Center', top: '50%', left: '50%', width: '40%', transform: 'translate(-50%, -50%)' },
  { label: 'Drinkware / Mug Wrap', top: '48%', left: '50%', width: '32%', transform: 'translate(-50%, -50%)' },
  { label: 'Back Center', top: '42%', left: '50%', width: '30%', transform: 'translate(-50%, -50%)' },
]

export default function ProductsClient({ initialProducts, categories }: ProductsClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [baselineProducts, setBaselineProducts] = useState<Product[]>(initialProducts)
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, any>>>({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [showSavedToast, setShowSavedToast] = useState(false)

  // Sync baseline if initialProducts change from external revalidation
  useEffect(() => {
    setProducts(initialProducts)
    setBaselineProducts(initialProducts)
    setPendingChanges({})
  }, [initialProducts])

  const pendingCount = Object.keys(pendingChanges).length
  const totalChangedFields = Object.values(pendingChanges).reduce((sum, changes) => sum + Object.keys(changes).length, 0)

  // Warn user before navigating away if there are unsaved staged changes
  useEffect(() => {
    if (pendingCount === 0) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [pendingCount])

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedFeatured, setSelectedFeatured] = useState<'all' | 'featured'>('all')
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'active' | 'featured' | 'retail' | 'bulk' | 'customizable' | 'draft'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'name-asc' | 'moq-asc'>('newest')
  const [sortField, setSortField] = useState<'name' | 'category' | 'price' | 'moq' | 'lead' | 'featured' | 'status' | 'retail' | 'customizable' | 'default'>('default')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [isPending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [activeTab, setActiveTab] = useState<ModalTab>('general')
  const [uploadingState, setUploadingState] = useState<'gallery' | number | null>(null)
  const [tagInputValue, setTagInputValue] = useState('')
  const [directImageUrl, setDirectImageUrl] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category_id: '',
    description: '',
    short_desc: '',
    base_price: '',
    min_order_qty: 50,
    lead_time_days: 15,
    is_featured: false,
    is_active: true,
    is_customizable: false,
    is_retail: true,
    tags: [] as string[],
    source_pdf: '',
    primary_image_url: '',
    image_gallery: [] as string[],
    color_variants: [] as ColorVariant[],
    branding_config: {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '40%',
    } as BrandingConfig,
  })

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const openAddModal = () => {
    setEditingProduct(null)
    setActiveTab('general')
    setFormData({
      name: '',
      slug: '',
      category_id: categories[0]?.id || '',
      description: '',
      short_desc: '',
      base_price: '',
      min_order_qty: 50,
      lead_time_days: 15,
      is_featured: false,
      is_active: true,
      is_customizable: false,
      is_retail: true,
      tags: [],
      source_pdf: '',
      primary_image_url: '',
      image_gallery: [],
      color_variants: [],
      branding_config: {
        top: '38%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '22%',
      },
    })
    setTagInputValue('')
    setDirectImageUrl('')
    setIsModalOpen(true)
  }

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod)
    setActiveTab('general')
    setFormData({
      name: prod.name,
      slug: prod.slug,
      category_id: prod.category_id || '',
      description: prod.description || '',
      short_desc: prod.short_desc || '',
      base_price: prod.base_price !== null && prod.base_price !== undefined ? prod.base_price.toString() : '',
      min_order_qty: prod.min_order_qty || 50,
      lead_time_days: prod.lead_time_days || 15,
      is_featured: Boolean(prod.is_featured),
      is_active: prod.is_active !== undefined ? Boolean(prod.is_active) : true,
      is_customizable: Boolean(prod.is_customizable),
      is_retail: prod.is_retail !== undefined
        ? Boolean(prod.is_retail)
        : ((prod.branding_config as any)?._is_retail !== undefined ? Boolean((prod.branding_config as any)._is_retail) : true),
      tags: Array.isArray(prod.tags) ? prod.tags : [],
      source_pdf: prod.source_pdf || '',
      primary_image_url: prod.primary_image_url || '',
      image_gallery: Array.isArray(prod.image_gallery) ? prod.image_gallery : (prod.primary_image_url ? [prod.primary_image_url] : []),
      color_variants: Array.isArray(prod.color_variants) ? prod.color_variants : [],
      branding_config: prod.branding_config || {
        top: '38%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '22%',
      },
    })
    setTagInputValue('')
    setDirectImageUrl('')
    setIsModalOpen(true)
  }

  // File Upload Handler (gallery or specific color variant)
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
        setFormData(prev => {
          const updatedGallery = [...prev.image_gallery, ...newUrls]
          return {
            ...prev,
            image_gallery: updatedGallery,
            primary_image_url: prev.primary_image_url || updatedGallery[0] || '',
          }
        })
      } else {
        const newVariants = [...formData.color_variants]
        if (newVariants[target]) {
          newVariants[target].images = [...(newVariants[target].images || []), ...newUrls]
          setFormData(prev => ({ ...prev, color_variants: newVariants }))
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload image. Please try again.')
      console.error(err)
    } finally {
      setUploadingState(null)
    }
  }

  const addDirectImage = () => {
    if (!directImageUrl.trim()) return
    const url = directImageUrl.trim()
    setFormData(prev => {
      const updatedGallery = [...prev.image_gallery, url]
      return {
        ...prev,
        image_gallery: updatedGallery,
        primary_image_url: prev.primary_image_url || url,
      }
    })
    setDirectImageUrl('')
  }

  const setAsPrimaryImage = (url: string) => {
    setFormData(prev => ({ ...prev, primary_image_url: url }))
  }

  const removeGalleryImage = (index: number) => {
    setFormData(prev => {
      const filtered = prev.image_gallery.filter((_, i) => i !== index)
      const newPrimary = prev.primary_image_url === prev.image_gallery[index]
        ? (filtered[0] || '')
        : prev.primary_image_url
      return {
        ...prev,
        image_gallery: filtered,
        primary_image_url: newPrimary,
      }
    })
  }

  // Tag Handlers
  const handleAddTag = () => {
    if (!tagInputValue.trim()) return
    const newTag = tagInputValue.trim().toLowerCase()
    if (!formData.tags.includes(newTag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag] }))
    }
    setTagInputValue('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }))
  }

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert('Product Name is required.')
      return
    }

    const cleanSlug = (formData.slug.trim() || generateSlug(formData.name))

    startTransition(async () => {
      try {
        const payload = {
          name: formData.name.trim(),
          slug: cleanSlug,
          category_id: formData.category_id || null,
          description: formData.description.trim() || null,
          short_desc: formData.short_desc.trim() || null,
          base_price: formData.base_price !== '' ? parseFloat(formData.base_price) : null,
          min_order_qty: Math.max(1, Number(formData.min_order_qty) || 50),
          lead_time_days: Math.max(1, Number(formData.lead_time_days) || 15),
          is_featured: formData.is_featured,
          is_active: formData.is_active,
          is_retail: formData.is_retail,
          is_customizable: formData.is_customizable,
          tags: formData.tags,
          source_pdf: formData.source_pdf.trim() || null,
          primary_image_url: formData.primary_image_url || formData.image_gallery[0] || null,
          image_gallery: formData.image_gallery,
          color_variants: formData.color_variants,
          branding_config: formData.is_customizable ? formData.branding_config : null,
        }

        if (editingProduct) {
          const res = await updateProduct(editingProduct.id, payload)
          if (res?.product) {
            const cat = categories.find(c => c.id === res.product.category_id)
            const updated = { ...res.product, categories: cat ? { name: cat.name } : null }
            setProducts(prev => prev.map(p => p.id === editingProduct.id ? updated : p))
            setBaselineProducts(prev => prev.map(p => p.id === editingProduct.id ? updated : p))
            setPendingChanges(prev => {
              const next = { ...prev }
              delete next[editingProduct.id]
              return next
            })
          }
        } else {
          const res = await createProduct(payload)
          if (res?.product) {
            const cat = categories.find(c => c.id === res.product.category_id)
            const created = { ...res.product, categories: cat ? { name: cat.name } : null }
            setProducts(prev => [created, ...prev])
            setBaselineProducts(prev => [created, ...prev])
          }
        }

        setIsModalOpen(false)
      } catch (err: any) {
        alert(err.message || 'Failed to save product.')
        console.error(err)
      }
    })
  }

  // Quick In-line Status Toggles (Staged locally, saved in single batch API call)
  const handleToggleStatus = (id: string, field: 'is_active' | 'is_featured' | 'is_retail' | 'is_customizable', currentValue: boolean) => {
    const nextValue = !currentValue

    // Instant local state update
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: nextValue } : p))

    // Stage change in pendingChanges
    setPendingChanges(prev => {
      const next = { ...prev }
      const baseline = baselineProducts.find(b => b.id === id)

      let baselineVal: boolean
      if (field === 'is_retail') {
        baselineVal = baseline ? (baseline.is_retail !== false && (baseline.branding_config as any)?._is_retail !== false) : true
      } else {
        baselineVal = baseline ? Boolean(baseline[field]) : false
      }

      const currentPendingForId = { ...(next[id] || {}) }
      if (nextValue === baselineVal) {
        delete currentPendingForId[field]
      } else {
        currentPendingForId[field] = nextValue
      }

      if (Object.keys(currentPendingForId).length === 0) {
        delete next[id]
      } else {
        next[id] = currentPendingForId
      }

      return next
    })
  }

  // Duplicate Product Action
  const handleDuplicate = async (id: string) => {
    startTransition(async () => {
      try {
        const res = await duplicateProduct(id)
        if (res?.product) {
          const cat = categories.find(c => c.id === res.product.category_id)
          const created = { ...res.product, categories: cat ? { name: cat.name } : null }
          setProducts(prev => [created, ...prev])
          setBaselineProducts(prev => [created, ...prev])
        }
      } catch (err: any) {
        alert(err.message || 'Failed to duplicate product.')
      }
    })
  }

  // Delete Product Action
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this product?')) return
    startTransition(async () => {
      try {
        await deleteProduct(id)
        setProducts(prev => prev.filter(p => p.id !== id))
        setBaselineProducts(prev => prev.filter(p => p.id !== id))
        setPendingChanges(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setSelectedIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } catch (err: any) {
        alert(err.message || 'Failed to delete product.')
      }
    })
  }

  // Quick metrics for pills
  const metrics = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.is_active).length,
    featured: products.filter(p => p.is_featured).length,
    retail: products.filter(p => p.is_retail !== false && (p.branding_config as any)?._is_retail !== false).length,
    bulkOnly: products.filter(p => p.is_retail === false || (p.branding_config as any)?._is_retail === false).length,
    customizable: products.filter(p => p.is_customizable).length,
    drafts: products.filter(p => !p.is_active).length,
  }), [products])

  // Bulk Actions
  const handleSelectAll = () => {
    if (selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedProducts.map(p => p.id)))
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Staged Bulk Changes (Updated locally, committed in single batch API call)
  const stageBulkChange = (field: 'is_active' | 'is_featured' | 'is_retail' | 'is_customizable', value: boolean) => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, [field]: value } : p))

    setPendingChanges(prev => {
      const next = { ...prev }
      ids.forEach(id => {
        const baseline = baselineProducts.find(b => b.id === id)
        let baselineVal: boolean
        if (field === 'is_retail') {
          baselineVal = baseline ? (baseline.is_retail !== false && (baseline.branding_config as any)?._is_retail !== false) : true
        } else {
          baselineVal = baseline ? Boolean(baseline[field]) : false
        }

        const currentPendingForId = { ...(next[id] || {}) }
        if (value === baselineVal) {
          delete currentPendingForId[field]
        } else {
          currentPendingForId[field] = value
        }

        if (Object.keys(currentPendingForId).length === 0) {
          delete next[id]
        } else {
          next[id] = currentPendingForId
        }
      })
      return next
    })

    setSelectedIds(new Set())
  }

  const handleBulkStatus = (is_active: boolean) => stageBulkChange('is_active', is_active)
  const handleBulkFeatured = (is_featured: boolean) => stageBulkChange('is_featured', is_featured)
  const handleBulkRetail = (is_retail: boolean) => stageBulkChange('is_retail', is_retail)
  const handleBulkCustomizable = (is_customizable: boolean) => stageBulkChange('is_customizable', is_customizable)

  // Commit all staged product changes in a SINGLE batch API call
  const handleSaveAllChanges = async () => {
    const ids = Object.keys(pendingChanges)
    if (ids.length === 0) return

    setIsSavingBatch(true)
    try {
      const updates = ids.map(id => ({
        id,
        changes: pendingChanges[id],
      }))

      const res = await batchUpdateProducts(updates)
      if (res.errors && res.errors.length > 0) {
        alert(`Saved ${res.count} products, but encountered issues:\n` + res.errors.join('\n'))
      }

      setBaselineProducts([...products])
      setPendingChanges({})
      setShowSavedToast(true)
      setTimeout(() => setShowSavedToast(false), 3500)
    } catch (err: any) {
      alert('Failed to save changes: ' + (err.message || 'Unknown error'))
    } finally {
      setIsSavingBatch(false)
    }
  }

  // Discard all staged changes and revert UI to clean baseline snapshot
  const handleDiscardAllChanges = () => {
    if (!confirm('Discard all unsaved changes and revert to original values?')) return
    setProducts([...baselineProducts])
    setPendingChanges({})
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.size} selected products?`)) return
    const ids = Array.from(selectedIds)
    setProducts(prev => prev.filter(p => !ids.includes(p.id)))
    setBaselineProducts(prev => prev.filter(p => !ids.includes(p.id)))
    setPendingChanges(prev => {
      const next = { ...prev }
      ids.forEach(id => delete next[id])
      return next
    })
    try {
      await Promise.all(ids.map(id => deleteProduct(id)))
      setSelectedIds(new Set())
    } catch (err: any) {
      alert('Error deleting products: ' + (err.message || 'Unknown error'))
    }
  }

  const handleHeaderSort = (field: 'name' | 'category' | 'price' | 'moq' | 'lead' | 'featured' | 'status' | 'retail' | 'customizable') => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const renderSortIndicator = (field: 'name' | 'category' | 'price' | 'moq' | 'lead' | 'featured' | 'status' | 'retail' | 'customizable') => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-40 transition-opacity ml-1 inline-block shrink-0" />
    }
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="text-[#e3231c] ml-1 inline-block shrink-0" />
      : <ArrowDown size={12} className="text-[#e3231c] ml-1 inline-block shrink-0" />
  }

  // Filter & Sort Pipeline
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = search.trim().toLowerCase()
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.categories?.name?.toLowerCase().includes(q) ||
        (Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(q)))

      const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory

      const isRetail = p.is_retail !== false && (p.branding_config as any)?._is_retail !== false
      const matchesTab =
        activeTabFilter === 'all' ? true :
        activeTabFilter === 'active' ? p.is_active :
        activeTabFilter === 'featured' ? p.is_featured :
        activeTabFilter === 'retail' ? isRetail :
        activeTabFilter === 'bulk' ? !isRetail :
        activeTabFilter === 'customizable' ? p.is_customizable :
        activeTabFilter === 'draft' ? !p.is_active : true

      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && p.is_active) ||
        (selectedStatus === 'inactive' && !p.is_active)

      const matchesFeatured =
        selectedFeatured === 'all' ||
        (selectedFeatured === 'featured' && p.is_featured)

      return matchesSearch && matchesCategory && matchesTab && matchesStatus && matchesFeatured
    }).sort((a, b) => {
      if (sortField === 'name') {
        const res = a.name.localeCompare(b.name)
        return sortDir === 'asc' ? res : -res
      }
      if (sortField === 'category') {
        const catA = a.categories?.name || ''
        const catB = b.categories?.name || ''
        const res = catA.localeCompare(catB)
        return sortDir === 'asc' ? res : -res
      }
      if (sortField === 'price') {
        const pA = a.base_price ?? -1
        const pB = b.base_price ?? -1
        return sortDir === 'asc' ? pA - pB : pB - pA
      }
      if (sortField === 'moq') {
        const mA = a.min_order_qty || 0
        const mB = b.min_order_qty || 0
        return sortDir === 'asc' ? mA - mB : mB - mA
      }
      if (sortField === 'lead') {
        const lA = a.lead_time_days || 0
        const lB = b.lead_time_days || 0
        return sortDir === 'asc' ? lA - lB : lB - lA
      }
      if (sortField === 'featured') {
        const fA = a.is_featured ? 1 : 0
        const fB = b.is_featured ? 1 : 0
        return sortDir === 'asc' ? fA - fB : fB - fA
      }
      if (sortField === 'status') {
        const sA = a.is_active ? 1 : 0
        const sB = b.is_active ? 1 : 0
        return sortDir === 'asc' ? sA - sB : sB - sA
      }
      if (sortField === 'retail') {
        const rA = a.is_retail !== false ? 1 : 0
        const rB = b.is_retail !== false ? 1 : 0
        return sortDir === 'asc' ? rA - rB : rB - rA
      }
      if (sortField === 'customizable') {
        const cA = a.is_customizable ? 1 : 0
        const cB = b.is_customizable ? 1 : 0
        return sortDir === 'asc' ? cA - cB : cB - cA
      }

      if (sortBy === 'newest') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      }
      if (sortBy === 'price-asc') {
        return (a.base_price || 0) - (b.base_price || 0)
      }
      if (sortBy === 'price-desc') {
        return (b.base_price || 0) - (a.base_price || 0)
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name)
      }
      if (sortBy === 'moq-asc') {
        return (a.min_order_qty || 0) - (b.min_order_qty || 0)
      }
      return 0
    })
  }, [products, search, selectedCategory, activeTabFilter, selectedStatus, selectedFeatured, sortField, sortDir, sortBy])

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedCategory, activeTabFilter, selectedStatus, selectedFeatured, sortField, sortDir, sortBy, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const paginatedProducts = useMemo(() => {
    if (pageSize >= 9999) return filteredProducts
    const start = (currentPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, currentPage, pageSize])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* ─── QUICK METRICS TABS STRIP ────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => { setActiveTabFilter('all'); setSelectedStatus('all'); setSelectedFeatured('all') }}
          className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0 flex items-center gap-2 ${
            activeTabFilter === 'all' && selectedStatus === 'all' && selectedFeatured === 'all'
              ? 'bg-[#1d1d1f] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-[#86868b] hover:text-[#1d1d1f] border border-black/5 shadow-2xs'
          }`}
        >
          <span>All Products</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTabFilter === 'all' && selectedStatus === 'all' && selectedFeatured === 'all' ? 'bg-white/20 text-white' : 'bg-black/5 text-[#86868b]'
          }`}>
            {metrics.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTabFilter('active'); setSelectedStatus('all'); setSelectedFeatured('all') }}
          className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0 flex items-center gap-2 ${
            activeTabFilter === 'active'
              ? 'bg-[#1d1d1f] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-[#86868b] hover:text-[#1d1d1f] border border-black/5 shadow-2xs'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>Active</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTabFilter === 'active' ? 'bg-white/20 text-white' : 'bg-black/5 text-[#86868b]'
          }`}>
            {metrics.active}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTabFilter('featured'); setSelectedStatus('all'); setSelectedFeatured('all') }}
          className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0 flex items-center gap-2 ${
            activeTabFilter === 'featured'
              ? 'bg-[#1d1d1f] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-[#86868b] hover:text-[#1d1d1f] border border-black/5 shadow-2xs'
          }`}
          title="Featured products appear on Homepage (top 8) and pinned at the top of /products"
        >
          <Star size={13} className="text-amber-400 fill-amber-400" />
          <span>Featured</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTabFilter === 'featured' ? 'bg-white/20 text-white' : 'bg-black/5 text-[#86868b]'
          }`}>
            {metrics.featured}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTabFilter('retail'); setSelectedStatus('all'); setSelectedFeatured('all') }}
          className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0 flex items-center gap-2 ${
            activeTabFilter === 'retail'
              ? 'bg-[#1d1d1f] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-[#86868b] hover:text-[#1d1d1f] border border-black/5 shadow-2xs'
          }`}
          title="Products enabled for direct online single-unit checkout"
        >
          <ShoppingBag size={13} className="text-blue-500" />
          <span>Retail (B2C)</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTabFilter === 'retail' ? 'bg-white/20 text-white' : 'bg-black/5 text-[#86868b]'
          }`}>
            {metrics.retail}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTabFilter('bulk'); setSelectedStatus('all'); setSelectedFeatured('all') }}
          className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0 flex items-center gap-2 ${
            activeTabFilter === 'bulk'
              ? 'bg-[#1d1d1f] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-[#86868b] hover:text-[#1d1d1f] border border-black/5 shadow-2xs'
          }`}
          title="Products restricted to bulk wholesale & corporate quote inquiries only"
        >
          <Users size={13} className="text-amber-600" />
          <span>Bulk Only (B2B)</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTabFilter === 'bulk' ? 'bg-white/20 text-white' : 'bg-black/5 text-[#86868b]'
          }`}>
            {metrics.bulkOnly}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTabFilter('customizable'); setSelectedStatus('all'); setSelectedFeatured('all') }}
          className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0 flex items-center gap-2 ${
            activeTabFilter === 'customizable'
              ? 'bg-[#1d1d1f] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-[#86868b] hover:text-[#1d1d1f] border border-black/5 shadow-2xs'
          }`}
        >
          <Paintbrush size={13} className="text-purple-500" />
          <span>Customizable</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTabFilter === 'customizable' ? 'bg-white/20 text-white' : 'bg-black/5 text-[#86868b]'
          }`}>
            {metrics.customizable}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTabFilter('draft'); setSelectedStatus('all'); setSelectedFeatured('all') }}
          className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0 flex items-center gap-2 ${
            activeTabFilter === 'draft'
              ? 'bg-[#1d1d1f] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-[#86868b] hover:text-[#1d1d1f] border border-black/5 shadow-2xs'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-neutral-400 inline-block" />
          <span>Drafts</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTabFilter === 'draft' ? 'bg-white/20 text-white' : 'bg-black/5 text-[#86868b]'
          }`}>
            {metrics.drafts}
          </span>
        </button>
      </div>

      {/* ─── TOOLBAR & CONTROLS ────────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-2xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, tag, category..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-black/5 bg-[#f5f5f7] text-[13px] font-medium text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 transition-all placeholder:text-[#86868b]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#f5f5f7] p-1 rounded-xl border border-black/5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                title="Table View"
              >
                <List size={16} />
              </button>
            </div>

            {/* Add Product Button */}
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-[#e3231c] hover:bg-[#b91a14] text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all shadow-md shadow-[#e3231c]/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={15} /> Add Product
            </button>
          </div>
        </div>

        {/* Filters & Sorting Strip */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-black/[0.04]">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#f5f5f7] text-[12px] font-semibold text-[#1d1d1f] border border-black/5 hover:border-black/10 focus:outline-none cursor-pointer"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-[#f5f5f7] text-[12px] font-semibold text-[#1d1d1f] border border-black/5 hover:border-black/10 focus:outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive / Draft</option>
          </select>

          {/* Featured Filter */}
          <select
            value={selectedFeatured}
            onChange={(e) => setSelectedFeatured(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-[#f5f5f7] text-[12px] font-semibold text-[#1d1d1f] border border-black/5 hover:border-black/10 focus:outline-none cursor-pointer"
          >
            <option value="all">All Catalog</option>
            <option value="featured">Featured Only ⭐</option>
          </select>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown size={13} className="text-[#86868b]" />
            <select
              value={sortField === 'default' ? sortBy : 'custom'}
              onChange={(e) => {
                setSortField('default')
                setSortBy(e.target.value as any)
              }}
              className="px-3 py-2 rounded-xl bg-[#f5f5f7] text-[12px] font-semibold text-[#1d1d1f] border border-black/5 hover:border-black/10 focus:outline-none cursor-pointer"
            >
              {sortField !== 'default' && <option value="custom">Column Sorted ({sortField})</option>}
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="moq-asc">MOQ: Low to High</option>
            </select>
          </div>

          <span className="text-[12px] font-medium text-[#86868b] px-2 whitespace-nowrap">
            Showing <strong>{filteredProducts.length}</strong> of {products.length}
          </span>
        </div>
      </div>

      {/* ─── PRODUCT LIST (GRID OR TABLE) ─────────────────────────────────── */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-[24px] border border-white shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-4 text-[#86868b]">
            <Package size={28} />
          </div>
          <h3 className="text-lg font-semibold text-[#1d1d1f]">No products found</h3>
          <p className="text-[#86868b] text-[14px] mt-1">Try adjusting your search terms or filters.</p>
          {(search || selectedCategory !== 'all' || activeTabFilter !== 'all' || selectedStatus !== 'all' || selectedFeatured !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSelectedCategory('all')
                setActiveTabFilter('all')
                setSelectedStatus('all')
                setSelectedFeatured('all')
                setSortField('default')
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-semibold hover:bg-black transition-all"
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedProducts.map((prod) => {
            const isUnsaved = Boolean(pendingChanges[prod.id])
            const hasRetailChanged = pendingChanges[prod.id]?.is_retail !== undefined
            const hasCustomizableChanged = pendingChanges[prod.id]?.is_customizable !== undefined
            const hasFeaturedChanged = pendingChanges[prod.id]?.is_featured !== undefined
            const hasActiveChanged = pendingChanges[prod.id]?.is_active !== undefined

            return (
              <div
                key={prod.id}
                className={`group relative rounded-[24px] overflow-hidden bg-white transition-all duration-300 flex flex-col ${
                  isUnsaved
                    ? 'ring-2 ring-[#0066FF] shadow-lg shadow-blue-500/15'
                    : 'shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] border border-black/[0.06] hover:shadow-xl hover:border-black/15 hover:-translate-y-1'
                }`}
              >
                {/* Product Image Area */}
                <div className="relative aspect-square w-full bg-[#f8f8fa] overflow-hidden">
                  {prod.primary_image_url ? (
                    <Image
                      src={prod.primary_image_url}
                      alt={prod.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-black/20">
                      <ImageIcon size={36} />
                    </div>
                  )}

                  {/* Top Overlay Bar: Category Pill & Star + Status */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-auto">
                    {/* Clean Category Pill + Unsaved indicator */}
                    <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                      <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-[11px] font-bold text-[#1d1d1f] shadow-xs border border-black/5 truncate">
                        {prod.categories?.name || 'Apparel'}
                      </span>
                      {isUnsaved && (
                        <span className="px-2 py-0.5 rounded-full bg-[#0066FF] text-white text-[9px] font-extrabold uppercase tracking-wider shadow-xs shrink-0">
                          Unsaved
                        </span>
                      )}
                    </div>

                    {/* Top Right: Featured Star & Active/Draft Status */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Featured Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(prod.id, 'is_featured', prod.is_featured)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-xs ${
                          hasFeaturedChanged ? 'ring-2 ring-[#0066FF] ring-offset-1' : ''
                        } ${
                          prod.is_featured
                            ? 'bg-amber-400 text-white hover:bg-amber-500'
                            : 'bg-white/90 backdrop-blur-md text-black/30 hover:text-amber-500 hover:bg-white'
                        }`}
                        title={prod.is_featured ? 'Featured on Homepage & top of catalog. Click to unfeature.' : 'Click to feature'}
                      >
                        <Star size={13} fill={prod.is_featured ? 'currentColor' : 'none'} />
                      </button>

                      {/* Active/Inactive Toggle Pill */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(prod.id, 'is_active', prod.is_active)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all shadow-xs backdrop-blur-md ${
                          hasActiveChanged ? 'ring-2 ring-[#0066FF] ring-offset-1' : ''
                        } ${
                          prod.is_active
                            ? 'bg-white/95 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-50'
                            : 'bg-black/75 text-white/90 hover:bg-black'
                        }`}
                        title="Click to toggle Active / Draft"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${prod.is_active ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                        <span>{prod.is_active ? 'Active' : 'Draft'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Bottom Overlays: Clean Feature Badges */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                    {prod.is_customizable ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 text-[#0066FF] text-[10px] font-bold backdrop-blur-md border border-[#0066FF]/20 shadow-xs pointer-events-auto">
                        <Paintbrush size={11} className="text-[#0066FF]" />
                        <span>Customizable</span>
                      </span>
                    ) : <span />}

                    {prod.is_retail === false ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900/90 text-amber-300 text-[10px] font-bold backdrop-blur-md shadow-xs pointer-events-auto">
                        <Building2 size={11} />
                        <span>Wholesale Only</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Product Info Section */}
                <div className="p-4 flex flex-col flex-1 justify-between gap-3 bg-white">
                  <div>
                    {/* Full Product Title (2 lines without mid-word cut-off) */}
                    <h3
                      onClick={() => openEditModal(prod)}
                      className="text-[14px] md:text-[15px] font-bold text-[#1d1d1f] line-clamp-2 min-h-[40px] leading-snug hover:text-[#e3231c] cursor-pointer transition-colors"
                      title={prod.name}
                    >
                      {prod.name}
                    </h3>
                    <p className="text-[12px] text-[#86868b] line-clamp-1 mt-1 leading-relaxed">
                      {prod.short_desc || 'No description provided.'}
                    </p>

                    {/* Channel & Customization Quick Action Pills */}
                    <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-black/[0.04]">
                      {/* Channel Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(prod.id, 'is_retail', prod.is_retail !== false)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          hasRetailChanged ? 'ring-2 ring-[#0066FF] ring-offset-1' : ''
                        } ${
                          prod.is_retail !== false
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60'
                        }`}
                        title={prod.is_retail !== false ? 'Retail + Bulk: Single unit checkout allowed. Click for Bulk Only.' : 'Bulk Only: RFQ quote only. Click to allow Retail.'}
                      >
                        {prod.is_retail !== false ? <ShoppingBag size={11} className="text-blue-600" /> : <Users size={11} className="text-purple-600" />}
                        <span>{prod.is_retail !== false ? 'Retail' : 'Bulk Only'}</span>
                      </button>

                      {/* Customizable Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(prod.id, 'is_customizable', prod.is_customizable)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          hasCustomizableChanged ? 'ring-2 ring-[#0066FF] ring-offset-1' : ''
                        } ${
                          prod.is_customizable
                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60'
                            : 'bg-[#f5f5f7] text-[#86868b] hover:bg-neutral-200 border border-black/5'
                        }`}
                        title={prod.is_customizable ? 'Customizable: Logo Studio enabled. Click to disable.' : 'Standard: Non-customizable. Click to enable logo customization.'}
                      >
                        <Paintbrush size={11} className={prod.is_customizable ? 'text-indigo-600' : 'text-black/30'} />
                        <span>{prod.is_customizable ? 'Logo Studio' : 'Standard'}</span>
                      </button>
                    </div>

                  {/* Price & MOQ Row */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-black/[0.04]">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-[#86868b] tracking-wider">Price</span>
                      <span className="text-[16px] font-extrabold text-[#1d1d1f]">
                        {prod.base_price !== null && prod.base_price !== undefined ? `₹${prod.base_price.toLocaleString('en-IN')}` : 'Quote Only'}
                      </span>
                    </div>

                    <div className="flex flex-col text-right">
                      <span className="text-[10px] uppercase font-bold text-[#86868b] tracking-wider">MOQ (Int.)</span>
                      <span className="text-[13px] font-bold text-[#1d1d1f]">{prod.min_order_qty || 50} units</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons Strip */}
                <div className="flex items-center justify-between pt-3 mt-1 border-t border-black/[0.06]">
                  <div className="flex items-center gap-1">
                    <a
                      href={`http://localhost:3000/products/${prod.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                      title="View on Storefront"
                    >
                      <Eye size={15} />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(prod.id)}
                      disabled={isPending}
                      className="p-2 rounded-xl text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                      title="Duplicate Product"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(prod.id)}
                      disabled={isPending}
                      className="p-2 rounded-xl text-[#86868b] hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <button
                    onClick={() => openEditModal(prod)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-[12px] font-bold transition-all shadow-xs hover:scale-105 active:scale-95"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          )})}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white/80 backdrop-blur-2xl rounded-[24px] border border-black/5 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#fbfbfd]/90 text-[11px] font-bold uppercase tracking-wider text-[#86868b] select-none">
                  {/* Select All Checkbox */}
                  <th className="py-3.5 pl-5 pr-2 w-10">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[#86868b] hover:text-[#1d1d1f] transition-colors flex items-center"
                      title="Select all on this page"
                    >
                      {selectedIds.size > 0 && selectedIds.size === paginatedProducts.length ? (
                        <CheckSquare size={16} className="text-[#e3231c]" />
                      ) : selectedIds.size > 0 ? (
                        <MinusSquare size={16} className="text-[#e3231c]" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>

                  <th
                    onClick={() => handleHeaderSort('name')}
                    className="py-3.5 px-4 cursor-pointer hover:text-[#1d1d1f] group transition-colors min-w-[280px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Product</span>
                      {renderSortIndicator('name')}
                    </div>
                  </th>

                  <th
                    onClick={() => handleHeaderSort('category')}
                    className="py-3.5 px-4 cursor-pointer hover:text-[#1d1d1f] group transition-colors min-w-[170px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Category</span>
                      {renderSortIndicator('category')}
                    </div>
                  </th>

                  <th
                    onClick={() => handleHeaderSort('price')}
                    className="py-3.5 px-4 cursor-pointer hover:text-[#1d1d1f] group transition-colors min-w-[105px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Price</span>
                      {renderSortIndicator('price')}
                    </div>
                  </th>

                  <th
                    onClick={() => handleHeaderSort('moq')}
                    className="py-3.5 px-4 cursor-pointer hover:text-[#1d1d1f] group transition-colors min-w-[95px]"
                    title="Internal minimum benchmark. Client storefront shows Quote on Inquiry."
                  >
                    <div className="flex items-center gap-1">
                      <span>MOQ (Int.)</span>
                      {renderSortIndicator('moq')}
                    </div>
                  </th>

                  <th
                    onClick={() => handleHeaderSort('lead')}
                    className="py-3.5 px-4 cursor-pointer hover:text-[#1d1d1f] group transition-colors min-w-[105px]"
                    title="Internal production timeline benchmark."
                  >
                    <div className="flex items-center gap-1">
                      <span>Lead Time (Int.)</span>
                      {renderSortIndicator('lead')}
                    </div>
                  </th>

                  <th
                    onClick={() => handleHeaderSort('retail')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-[#1d1d1f] group transition-colors min-w-[115px]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Channel</span>
                      {renderSortIndicator('retail')}
                    </div>
                  </th>

                  <th
                    onClick={() => handleHeaderSort('customizable')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-[#1d1d1f] group transition-colors min-w-[130px]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Customizable</span>
                      {renderSortIndicator('customizable')}
                    </div>
                  </th>

                  <th
                    onClick={() => handleHeaderSort('featured')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-[#1d1d1f] group transition-colors min-w-[120px]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Featured</span>
                      {renderSortIndicator('featured')}
                    </div>
                  </th>

                  <th
                    onClick={() => handleHeaderSort('status')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-[#1d1d1f] group transition-colors min-w-[105px]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      {renderSortIndicator('status')}
                    </div>
                  </th>

                  <th className="py-3.5 px-5 text-right min-w-[150px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] text-[13px]">
                {paginatedProducts.map((prod) => {
                  const isSelected = selectedIds.has(prod.id)
                  const isUnsaved = Boolean(pendingChanges[prod.id])
                  const hasRetailChanged = pendingChanges[prod.id]?.is_retail !== undefined
                  const hasCustomizableChanged = pendingChanges[prod.id]?.is_customizable !== undefined
                  const hasFeaturedChanged = pendingChanges[prod.id]?.is_featured !== undefined
                  const hasActiveChanged = pendingChanges[prod.id]?.is_active !== undefined

                  return (
                    <tr
                      key={prod.id}
                      className={`group transition-colors ${
                        isUnsaved
                          ? 'bg-blue-50/50 hover:bg-blue-50/70 border-l-4 border-l-[#0066FF]'
                          : isSelected
                          ? 'bg-red-50/30 hover:bg-red-50/40'
                          : 'hover:bg-black/[0.015]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-5 pr-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(prod.id)}
                          className="text-[#86868b] hover:text-[#1d1d1f] transition-colors flex items-center"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-[#e3231c]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Product Thumbnail & Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => openEditModal(prod)}
                            className="relative w-12 h-12 rounded-xl bg-[#f5f5f7] overflow-hidden shrink-0 border border-black/5 shadow-2xs cursor-pointer group-hover:scale-105 transition-transform"
                          >
                            {prod.primary_image_url ? (
                              <Image src={prod.primary_image_url} alt="" fill className="object-cover" unoptimized />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-black/20">
                                <ImageIcon size={20} />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col min-w-0 max-w-[280px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                onClick={() => openEditModal(prod)}
                                className="font-bold text-[#1d1d1f] truncate hover:text-[#e3231c] cursor-pointer transition-colors"
                                title={prod.name}
                              >
                                {prod.name}
                              </span>
                              {isUnsaved && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 text-[#0066FF] border border-blue-200 text-[10px] font-extrabold tracking-wide uppercase" title="Unsaved changes pending in this row">
                                  Unsaved
                                </span>
                              )}
                              {prod.is_customizable && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 text-[10px] font-bold" title="Supports visual logo placement canvas">
                                  <Paintbrush size={9} /> 3D Logo
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-[#86868b] font-mono truncate max-w-[180px]">{prod.slug}</span>
                              {Array.isArray(prod.color_variants) && prod.color_variants.length > 0 && (
                                <div className="flex items-center -space-x-1">
                                  {prod.color_variants.slice(0, 4).map((c, i) => (
                                    <span
                                      key={i}
                                      className="w-2.5 h-2.5 rounded-full border border-white shadow-2xs"
                                      style={{ backgroundColor: c.hex || '#999' }}
                                      title={c.name}
                                    />
                                  ))}
                                  {prod.color_variants.length > 4 && (
                                    <span className="text-[9px] text-[#86868b] pl-1.5 font-bold">+{prod.color_variants.length - 4}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category - Single Line, NO awkward 3-line wrap! */}
                      <td className="py-3.5 px-4 font-medium text-[#1d1d1f]">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f5f5f7] border border-black/5 text-[11px] font-semibold text-[#1d1d1f] whitespace-nowrap shadow-2xs">
                          {prod.categories?.name || 'Uncategorized'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {prod.base_price !== null && prod.base_price !== undefined ? (
                          <span className="text-[13px] font-bold text-[#1d1d1f]">
                            ₹{prod.base_price.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/5 text-[#86868b] text-[11px] font-semibold">
                            Quote Only
                          </span>
                        )}
                      </td>

                      {/* MOQ - Single Line */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-[#1d1d1f] text-[13px]">{prod.min_order_qty}</span>{' '}
                        <span className="text-[11px] text-[#86868b] font-medium">units</span>
                      </td>

                      {/* Lead Time - Single Line */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-[#1d1d1f] text-[13px]">{prod.lead_time_days}</span>{' '}
                        <span className="text-[11px] text-[#86868b] font-medium">days</span>
                      </td>

                      {/* Retail / Bulk Channel Quick Toggle */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(prod.id, 'is_retail', prod.is_retail !== false)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 ${
                            hasRetailChanged ? 'ring-2 ring-[#0066FF] ring-offset-1' : ''
                          } ${
                            prod.is_retail !== false
                              ? 'bg-blue-50 hover:bg-blue-100 border border-blue-200/90 text-blue-800'
                              : 'bg-purple-50 hover:bg-purple-100 border border-purple-200/90 text-purple-800'
                          }`}
                          title={
                            prod.is_retail !== false
                              ? 'Retail + Bulk: Single-unit checkout enabled. Click to set Bulk Only.'
                              : 'Bulk Wholesale Only: Single-unit checkout disabled. Click to enable Retail.'
                          }
                        >
                          {prod.is_retail !== false ? (
                            <>
                              <ShoppingBag size={11} className="text-blue-600" /> Retail
                            </>
                          ) : (
                            <>
                              <Users size={11} className="text-purple-600" /> Bulk Only
                            </>
                          )}
                        </button>
                      </td>

                      {/* Customizable Quick Toggle */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(prod.id, 'is_customizable', prod.is_customizable)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 ${
                            hasCustomizableChanged ? 'ring-2 ring-[#0066FF] ring-offset-1' : ''
                          } ${
                            prod.is_customizable
                              ? 'bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 text-indigo-800'
                              : 'bg-[#f5f5f7] hover:bg-indigo-50/70 border border-black/5 hover:border-indigo-200 text-[#86868b] hover:text-indigo-700'
                          }`}
                          title={
                            prod.is_customizable
                              ? 'Customizable: Logo Studio & storefront visualizer enabled. Click to disable.'
                              : 'Standard: Non-customizable. Click to enable custom logo branding.'
                          }
                        >
                          <Paintbrush size={11} className={prod.is_customizable ? 'text-indigo-600' : 'text-black/30'} />
                          {prod.is_customizable ? 'Customizable' : 'Off'}
                        </button>
                      </td>

                      {/* Featured Quick Toggle with tooltip */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(prod.id, 'is_featured', prod.is_featured)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 ${
                            hasFeaturedChanged ? 'ring-2 ring-[#0066FF] ring-offset-1' : ''
                          } ${
                            prod.is_featured
                              ? 'bg-amber-50 hover:bg-amber-100 border border-amber-200/90 text-amber-800'
                              : 'bg-[#f5f5f7] hover:bg-amber-50/70 border border-black/5 hover:border-amber-200 text-[#86868b] hover:text-amber-700'
                          }`}
                          title={prod.is_featured ? 'Featured: Priority ranking on Homepage and top of catalog. Click to unfeature.' : 'Standard: Click to feature on Homepage & top of catalog.'}
                        >
                          <Star size={12} className={prod.is_featured ? 'fill-amber-400 text-amber-500' : 'text-black/30'} />
                          {prod.is_featured ? 'Featured' : 'Standard'}
                        </button>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(prod.id, 'is_active', prod.is_active)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all shadow-2xs hover:scale-105 active:scale-95 ${
                            hasActiveChanged ? 'ring-2 ring-[#0066FF] ring-offset-1' : ''
                          } ${
                            prod.is_active
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-[#86868b] border border-neutral-200'
                          }`}
                          title={prod.is_active ? '● Active: Visible in Storefront. Click to set Draft.' : '○ Draft: Hidden from Storefront. Click to set Active.'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${prod.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
                          {prod.is_active ? 'Active' : 'Draft'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`http://localhost:3000/products/${prod.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all"
                            title="View Live on Storefront"
                          >
                            <Eye size={15} />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(prod.id)}
                            disabled={isPending}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all"
                            title="Duplicate Product"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(prod)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all"
                            title="Edit Product"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(prod.id)}
                            disabled={isPending}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#86868b] hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Delete Product"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── PAGINATION BAR ────────────────────────────────────────── */}
      {filteredProducts.length > 0 && (
        <div className="bg-white/80 backdrop-blur-2xl rounded-[20px] border border-white shadow-2xs p-4 flex flex-wrap items-center justify-between gap-4 text-[13px]">
          <div className="flex items-center gap-3">
            <span className="text-[#86868b] font-medium">
              Showing <strong className="text-[#1d1d1f]">{Math.min(filteredProducts.length, (currentPage - 1) * pageSize + 1)}</strong> to{' '}
              <strong className="text-[#1d1d1f]">{Math.min(filteredProducts.length, currentPage * pageSize)}</strong> of{' '}
              <strong className="text-[#1d1d1f]">{filteredProducts.length}</strong> products
            </span>

            <div className="flex items-center gap-1.5 pl-3 border-l border-black/10">
              <span className="text-[12px] text-[#86868b]">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded-lg bg-[#f5f5f7] text-[12px] font-semibold text-[#1d1d1f] border border-black/5 focus:outline-none cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>All ({filteredProducts.length})</option>
              </select>
            </div>
          </div>

          {/* Page Navigation Buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-black/5 bg-white text-[#1d1d1f] font-semibold text-[12px] hover:bg-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs"
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1]
                    return (
                      <span key={p} className="flex items-center">
                        {prev && p - prev > 1 && (
                          <span className="px-1 text-[#86868b] text-[12px]">…</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 rounded-xl text-[12px] font-bold transition-all ${
                            currentPage === p
                              ? 'bg-[#1d1d1f] text-white shadow-2xs'
                              : 'bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-black/5'
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    )
                  })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-black/5 bg-white text-[#1d1d1f] font-semibold text-[12px] hover:bg-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── FLOATING BATCH SAVE CHANGES DOCK ─────────────────────────── */}
      {pendingCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1d1d1f] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 ring-1 ring-black/20 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2.5 pr-4 border-r border-white/15">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0066FF]"></span>
            </span>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold leading-tight text-white">
                {pendingCount} product{pendingCount > 1 ? 's' : ''} modified
              </span>
              <span className="text-[11px] text-white/60 font-medium">
                {totalChangedFields} change{totalChangedFields > 1 ? 's' : ''} staged
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDiscardAllChanges}
            disabled={isSavingBatch}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-white/80 hover:text-white text-[12px] font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            title="Discard all pending changes and revert to original values"
          >
            <RotateCcw size={13} />
            <span>Discard</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAllChanges}
            disabled={isSavingBatch}
            className="px-5 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13px] font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSavingBatch ? (
              <>
                <Loader2 size={15} className="animate-spin text-white" />
                <span>Saving All Changes...</span>
              </>
            ) : (
              <>
                <Save size={15} className="text-white" />
                <span>Save All Changes ({pendingCount})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ─── FLOATING BULK ACTIONS BAR ─────────────────────────── */}
      {selectedIds.size > 0 && (
        <div
          className={`fixed ${
            pendingCount > 0 ? 'bottom-24' : 'bottom-6'
          } left-1/2 -translate-x-1/2 z-40 bg-[#1d1d1f] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 animate-in fade-in slide-in-from-bottom-5 duration-200`}
        >
          <div className="flex items-center gap-2 pr-3 border-r border-white/15">
            <span className="w-5 h-5 rounded-full bg-[#e3231c] text-white text-[11px] font-extrabold flex items-center justify-center">
              {selectedIds.size}
            </span>
            <span className="text-[13px] font-semibold">selected</span>
          </div>

          <button
            type="button"
            onClick={() => handleBulkStatus(true)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[12px] font-semibold transition-all flex items-center gap-1.5"
          >
            <Check size={13} className="text-emerald-400" /> Set Active
          </button>

          <button
            type="button"
            onClick={() => handleBulkStatus(false)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[12px] font-semibold transition-all"
          >
            Set Draft
          </button>

          <button
            type="button"
            onClick={() => handleBulkFeatured(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[12px] font-semibold transition-all flex items-center gap-1.5"
          >
            <Star size={13} className="fill-amber-400 text-amber-400" /> Feature
          </button>

          <button
            type="button"
            onClick={() => handleBulkFeatured(false)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[12px] font-semibold transition-all"
          >
            Unfeature
          </button>

          <button
            type="button"
            onClick={() => handleBulkRetail(true)}
            className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[12px] font-semibold transition-all flex items-center gap-1.5"
          >
            <ShoppingBag size={13} /> Set Retail
          </button>

          <button
            type="button"
            onClick={() => handleBulkRetail(false)}
            className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[12px] font-semibold transition-all flex items-center gap-1.5"
          >
            <Building2 size={13} /> Bulk Only
          </button>

          <button
            type="button"
            onClick={() => handleBulkCustomizable(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[12px] font-semibold transition-all flex items-center gap-1.5"
          >
            <Paintbrush size={13} /> Customizable
          </button>

          <button
            type="button"
            onClick={() => handleBulkCustomizable(false)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[12px] font-semibold transition-all"
          >
            Standard
          </button>

          <button
            type="button"
            onClick={handleBulkDelete}
            className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[12px] font-semibold transition-all flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Delete
          </button>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="p-1 rounded-lg text-white/50 hover:text-white transition-colors ml-1"
            title="Deselect all"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ─── SAVED SUCCESS TOAST ─────────────────────────── */}
      {showSavedToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1d1d1f] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-500/30 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check size={16} className="stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-white">Changes Saved Successfully</span>
            <span className="text-[11px] text-white/60">All catalog updates committed in a single API call</span>
          </div>
        </div>
      )}

      {/* ─── FULL CRUD MODAL ──────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-black/10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 sm:px-8 sm:py-5 border-b border-black/[0.06] flex items-center justify-between bg-[#fbfbfd] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#e3231c]/10 text-[#e3231c] flex items-center justify-center">
                  <Package size={18} />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-[#1d1d1f] tracking-tight">
                    {editingProduct ? `Edit: ${editingProduct.name}` : 'Create New Product'}
                  </h2>
                  <p className="text-[12px] text-[#86868b]">
                    {editingProduct ? 'Modify all catalog details, pricing, media, and branding.' : 'Fill out details to publish a new catalog item.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center px-6 sm:px-8 border-b border-black/[0.06] bg-white overflow-x-auto shrink-0 gap-1">
              {[
                { id: 'general', label: 'Basic Info', icon: Tag },
                { id: 'pricing', label: 'Pricing & Supply', icon: DollarSign },
                { id: 'media', label: 'Images & Gallery', icon: ImageIcon },
                { id: 'variants', label: `Color Variants (${formData.color_variants.length})`, icon: Palette },
                { id: 'branding', label: 'Customizer Studio', icon: Paintbrush },
              ].map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as ModalTab)}
                    className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-[13px] font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'border-[#e3231c] text-[#e3231c]'
                        : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Modal Body / Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 min-h-0 bg-[#fbfbfd]">
              <form id="product-form" onSubmit={handleSubmit} className="space-y-6">

                {/* ─── TAB 1: BASIC INFO ─── */}
                {activeTab === 'general' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    {/* Product Name */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b] mb-1.5">
                        Product Name <span className="text-[#e3231c]">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => {
                          const newName = e.target.value
                          setFormData(prev => ({
                            ...prev,
                            name: newName,
                            slug: editingProduct ? prev.slug : generateSlug(newName),
                          }))
                        }}
                        placeholder="e.g. Matte Stainless Steel Thermal Tumbler"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 font-medium"
                      />
                    </div>

                    {/* Slug with Regenerate Button */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b]">
                          URL Slug <span className="text-[#e3231c]">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, slug: generateSlug(prev.name) }))}
                          className="text-[11px] text-[#e3231c] font-semibold hover:underline flex items-center gap-1"
                        >
                          <RefreshCw size={11} /> Auto-generate from Name
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-[#86868b] text-[13px] font-mono">/products/</span>
                        <input
                          type="text"
                          required
                          value={formData.slug}
                          onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-') })}
                          className="w-full pl-24 pr-4 py-2.5 rounded-xl bg-white border border-black/10 text-[13px] font-mono text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30"
                        />
                      </div>
                    </div>

                    {/* Category Selection */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b] mb-1.5">
                        Category
                      </label>
                      <select
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-[14px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 cursor-pointer"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Short Description */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b] mb-1.5">
                        Short Summary / Subtitle
                      </label>
                      <input
                        type="text"
                        value={formData.short_desc}
                        onChange={(e) => setFormData({ ...formData, short_desc: e.target.value })}
                        placeholder="e.g. 500ml double-wall vacuum insulated drinkware with temperature display."
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 font-medium"
                      />
                    </div>

                    {/* Detailed Description */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b] mb-1.5">
                        Detailed Description & Specifications
                      </label>
                      <textarea
                        rows={4}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed material specs, box contents, customization options, warranty, etc."
                        className="w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30 font-normal leading-relaxed"
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b] mb-1.5">
                        Tags & Keywords
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={tagInputValue}
                          onChange={(e) => setTagInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddTag()
                            }
                          }}
                          placeholder="Type tag (e.g. 'drinkware', 'corporate') & press Add"
                          className="flex-1 px-4 py-2 rounded-xl bg-white border border-black/10 text-[13px] text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30"
                        />
                        <button
                          type="button"
                          onClick={handleAddTag}
                          className="px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-semibold hover:bg-black transition-colors"
                        >
                          Add Tag
                        </button>
                      </div>

                      {formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {formData.tags.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-black/10 text-[12px] font-semibold text-[#1d1d1f]">
                              #{t}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(t)}
                                className="text-[#86868b] hover:text-red-600 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Source PDF Reference */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b] mb-1.5">
                        Source Catalog / PDF Document Reference (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.source_pdf}
                        onChange={(e) => setFormData({ ...formData, source_pdf: e.target.value })}
                        placeholder="e.g. Master-Drinkware-Catalog-2026.pdf"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-[13px] text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30"
                      />
                    </div>
                  </div>
                )}

                {/* ─── TAB 2: PRICING & SUPPLY ─── */}
                {activeTab === 'pricing' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Base Price */}
                      <div>
                        <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b] mb-1.5">
                          Base Selling Price (₹)
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-[#1d1d1f] font-bold text-[14px]">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.base_price}
                            onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                            placeholder="799"
                            className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white border border-black/10 text-[15px] font-bold text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30"
                          />
                        </div>
                        <p className="text-[11px] text-[#86868b] mt-1">Leave blank if available exclusively for bulk quote inquiries.</p>
                      </div>

                      {/* Minimum Order Quantity (MOQ) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b]">
                            Min. Order Qty (Internal Reference)
                          </label>
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Negotiable on Inquiry
                          </span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={formData.min_order_qty}
                          onChange={(e) => setFormData({ ...formData, min_order_qty: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-[14px] font-bold text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30"
                        />
                        <p className="text-[11px] text-[#86868b] mt-1">Internal benchmark for factory planning. Storefront displays &ldquo;Quote on Inquiry&rdquo; so you can negotiate directly.</p>
                      </div>

                      {/* Lead Time Days */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b]">
                            Lead Time Days (Internal Reference)
                          </label>
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Negotiable on Inquiry
                          </span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={formData.lead_time_days}
                          onChange={(e) => setFormData({ ...formData, lead_time_days: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-[14px] font-bold text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30"
                        />
                        <p className="text-[11px] text-[#86868b] mt-1">Internal benchmark timeline. Storefront displays flexible timeline on inquiry.</p>
                      </div>
                    </div>

                    {/* Visibility & Toggles Card */}
                    <div className="bg-white rounded-2xl p-5 border border-black/10 space-y-4">
                      <h4 className="text-[13px] font-bold uppercase tracking-wider text-[#1d1d1f]">Catalog Status & Visibility</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Retail Toggle */}
                        <label className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                          formData.is_retail 
                            ? 'bg-blue-50/40 border-blue-200/80 hover:bg-blue-50/70' 
                            : 'bg-purple-50/40 border-purple-200/80 hover:bg-purple-50/70'
                        }`}>
                          <div className="flex flex-col pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-bold text-[#1d1d1f]">Retail (B2C)</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                formData.is_retail ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {formData.is_retail ? 'Retail + Bulk' : 'Bulk Only'}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#86868b]">
                              {formData.is_retail ? 'Single-unit online cart allowed' : 'Wholesale RFQ quote only'}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={formData.is_retail}
                            onChange={(e) => setFormData({ ...formData, is_retail: e.target.checked })}
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500/20"
                          />
                        </label>

                        {/* Active Toggle */}
                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#fbfbfd] border border-black/5 cursor-pointer hover:bg-[#f5f5f7] transition-colors">
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-[#1d1d1f]">Active in Store</span>
                            <span className="text-[11px] text-[#86868b]">Visible to customers</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            className="w-5 h-5 rounded text-[#e3231c] focus:ring-[#e3231c]/20"
                          />
                        </label>

                        {/* Featured Toggle */}
                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#fbfbfd] border border-black/5 cursor-pointer hover:bg-[#f5f5f7] transition-colors">
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-[#1d1d1f]">Featured</span>
                            <span className="text-[11px] text-[#86868b]">Pinned on Homepage</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={formData.is_featured}
                            onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                            className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500/20"
                          />
                        </label>

                        {/* Customizable Toggle */}
                        <label className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer ${
                          formData.is_customizable ? 'bg-indigo-50/60 border-indigo-200' : 'bg-[#fbfbfd] border-black/5 hover:bg-[#f5f5f7]'
                        }`}>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-bold text-[#1d1d1f]">Logo Branding & Customization</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                formData.is_customizable ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-600'
                              }`}>
                                {formData.is_customizable ? 'Customizable' : 'Standard'}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#86868b]">
                              {formData.is_customizable
                                ? 'Clients can preview logos on product & launch 3D Studio'
                                : 'Logo imprint disabled for this product'}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={formData.is_customizable}
                            onChange={(e) => setFormData({ ...formData, is_customizable: e.target.checked })}
                            className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── TAB 3: MEDIA & GALLERY ─── */}
                {activeTab === 'media' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Drag & Drop Upload Zone */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#86868b] mb-1.5">
                        Upload Product Images (Compressed to WebP under 30KB automatically)
                      </label>
                      <div className="bg-white border-2 border-dashed border-black/15 rounded-2xl p-8 transition-all hover:bg-black/[0.02] hover:border-black/30 flex flex-col items-center justify-center relative min-h-[160px]">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'gallery')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {uploadingState === 'gallery' ? (
                          <div className="flex flex-col items-center text-[#e3231c]">
                            <Loader2 className="animate-spin mb-2" size={28} />
                            <p className="text-[14px] font-bold">Compressing & Uploading...</p>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-3 text-[#86868b]">
                              <UploadCloud size={24} />
                            </div>
                            <p className="text-[14px] font-bold text-[#1d1d1f]">Click or drag photos here</p>
                            <p className="text-[12px] text-[#86868b] mt-1">Supports JPG, PNG, WEBP. Optimized automatically.</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Direct Image URL input */}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={directImageUrl}
                        onChange={(e) => setDirectImageUrl(e.target.value)}
                        placeholder="Or enter direct image URL (https://...)"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-black/10 text-[13px] text-[#1d1d1f] focus:outline-none focus:ring-4 focus:ring-[#e3231c]/10 focus:border-[#e3231c]/30"
                      />
                      <button
                        type="button"
                        onClick={addDirectImage}
                        className="px-4 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-semibold hover:bg-black transition-colors"
                      >
                        Add URL
                      </button>
                    </div>

                    {/* Gallery Thumbnails List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[12px] font-bold uppercase tracking-wider text-[#86868b]">
                          Uploaded Gallery ({formData.image_gallery.length} images)
                        </label>
                        <span className="text-[11px] text-[#86868b]">⭐ Click star to set Primary Image</span>
                      </div>

                      {formData.image_gallery.length === 0 ? (
                        <div className="p-8 text-center bg-white rounded-2xl border border-black/5 text-[#86868b] text-[13px]">
                          No images uploaded yet. Upload at least one image for catalog display.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {formData.image_gallery.map((url, idx) => {
                            const isPrimary = formData.primary_image_url === url || (!formData.primary_image_url && idx === 0)
                            return (
                              <div
                                key={idx}
                                className={`relative rounded-2xl overflow-hidden bg-white border aspect-square group shadow-sm transition-all ${
                                  isPrimary ? 'ring-2 ring-[#e3231c] border-transparent' : 'border-black/10'
                                }`}
                              >
                                <Image src={url} alt="" fill className="object-cover" unoptimized />

                                {isPrimary && (
                                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#e3231c] text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                                    Primary
                                  </div>
                                )}

                                {/* Hover actions */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  {!isPrimary && (
                                    <button
                                      type="button"
                                      onClick={() => setAsPrimaryImage(url)}
                                      className="p-2 rounded-full bg-white text-amber-500 hover:scale-110 transition-transform shadow-md"
                                      title="Set as Primary"
                                    >
                                      <Star size={15} fill="currentColor" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeGalleryImage(idx)}
                                    className="p-2 rounded-full bg-white text-red-600 hover:scale-110 transition-transform shadow-md"
                                    title="Delete Image"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── TAB 4: COLOR VARIANTS ─── */}
                {activeTab === 'variants' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[15px] font-bold text-[#1d1d1f]">Product Color Variants</h3>
                        <p className="text-[12px] text-[#86868b]">Add multiple colorways with their own dedicated image angles.</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          color_variants: [...prev.color_variants, { name: '', hex: '#000000', images: [] }]
                        }))}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-[12px] font-bold transition-all shadow-sm"
                      >
                        <Plus size={14} /> Add Color Variant
                      </button>
                    </div>

                    {formData.color_variants.length === 0 ? (
                      <div className="p-10 text-center bg-white rounded-2xl border border-black/5 text-[#86868b] text-[13px]">
                        No color variants configured. Click "Add Color Variant" to add choices like Black, Navy Blue, etc.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {formData.color_variants.map((variant, i) => (
                          <div key={i} className="p-5 bg-white rounded-2xl border border-black/10 shadow-sm relative space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">
                                Variant #{i + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  color_variants: prev.color_variants.filter((_, idx) => idx !== i)
                                }))}
                                className="p-1.5 rounded-lg text-[#86868b] hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Remove Variant"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Variant Name */}
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#86868b] mb-1">
                                  Color Name
                                </label>
                                <input
                                  type="text"
                                  value={variant.name}
                                  onChange={(e) => {
                                    const next = [...formData.color_variants]
                                    next[i].name = e.target.value
                                    setFormData({ ...formData, color_variants: next })
                                  }}
                                  placeholder="e.g. Midnight Black"
                                  className="w-full px-3.5 py-2 rounded-xl bg-[#f5f5f7] border border-black/5 text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#e3231c]/20"
                                />
                              </div>

                              {/* Variant Hex */}
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#86868b] mb-1">
                                  Color Hex Code
                                </label>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="color"
                                    value={variant.hex}
                                    onChange={(e) => {
                                      const next = [...formData.color_variants]
                                      next[i].hex = e.target.value
                                      setFormData({ ...formData, color_variants: next })
                                    }}
                                    className="w-10 h-10 rounded-xl cursor-pointer border border-black/10 p-0.5 bg-white shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={variant.hex}
                                    onChange={(e) => {
                                      const next = [...formData.color_variants]
                                      next[i].hex = e.target.value
                                      setFormData({ ...formData, color_variants: next })
                                    }}
                                    className="w-full px-3.5 py-2 rounded-xl bg-[#f5f5f7] border border-black/5 text-[13px] font-mono text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#e3231c]/20"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Variant Images Upload */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#86868b] mb-1.5">
                                Variant Specific Photos ({variant.images?.length || 0})
                              </label>
                              
                              <div className="flex flex-wrap items-center gap-3">
                                {/* Upload Button */}
                                <div className="relative overflow-hidden rounded-xl border border-dashed border-black/20 bg-[#f5f5f7] hover:bg-black/5 px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors">
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, i)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  />
                                  {uploadingState === i ? (
                                    <Loader2 size={16} className="animate-spin text-[#e3231c]" />
                                  ) : (
                                    <UploadCloud size={16} className="text-[#86868b]" />
                                  )}
                                  <span className="text-[12px] font-semibold text-[#1d1d1f]">
                                    {uploadingState === i ? 'Uploading...' : 'Upload Photos'}
                                  </span>
                                </div>

                                {/* Variant Thumbnails */}
                                {variant.images?.map((url, imgIdx) => (
                                  <div key={imgIdx} className="relative w-12 h-12 rounded-xl bg-[#f5f5f7] border border-black/10 overflow-hidden shrink-0 group">
                                    <Image src={url} alt="" fill className="object-cover" unoptimized />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...formData.color_variants]
                                        next[i].images = next[i].images.filter((_, idx) => idx !== imgIdx)
                                        setFormData({ ...formData, color_variants: next })
                                      }}
                                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 5: 3D BRANDING STUDIO CONFIG (CANVAS EDITOR) ─── */}
                {activeTab === 'branding' && (
                  <BrandingCanvasEditor
                    brandingConfig={formData.branding_config}
                    onChange={(newConfig) => setFormData(prev => ({ ...prev, branding_config: newConfig }))}
                    productImage={formData.primary_image_url || formData.image_gallery[0] || ''}
                    imageGallery={formData.image_gallery}
                    isCustomizable={formData.is_customizable}
                    onToggleCustomizable={(val) => setFormData(prev => ({ ...prev, is_customizable: val }))}
                  />
                )}
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 sm:px-8 sm:py-5 border-t border-black/[0.06] bg-[#fbfbfd] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#86868b] hover:bg-black/5 transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  form="product-form"
                  disabled={isPending || uploadingState !== null}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold bg-[#e3231c] hover:bg-[#b91a14] text-white transition-all shadow-md shadow-[#e3231c]/20 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Saving Product...
                    </>
                  ) : (
                    <>
                      <Check size={15} /> Save Product
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ────────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-black/10 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-[17px] font-bold text-[#1d1d1f]">Delete this product?</h3>
              <p className="text-[13px] text-[#86868b] mt-1">
                This action cannot be undone. It will be removed immediately from the live storefront.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] text-[13px] font-semibold hover:bg-[#e5e5ea] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 transition-colors shadow-sm"
              >
                {isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
