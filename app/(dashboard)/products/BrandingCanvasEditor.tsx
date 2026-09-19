'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import {
  Move, Maximize2, Paintbrush, Sliders, RotateCcw, RotateCw,
  AlignCenter, AlignVerticalSpaceAround, Eye, Type, Upload,
  Layers, Check, ChevronDown, ChevronUp, Image as ImageIcon
} from 'lucide-react'

export interface BrandingConfig {
  top?: string
  left?: string
  width?: string
  transform?: string
  rotate?: number
  _is_retail?: boolean
}

export const parseRotation = (config: BrandingConfig | null | undefined): number => {
  if (!config) return 0
  if (typeof config.rotate === 'number' && !isNaN(config.rotate)) return config.rotate
  if (typeof (config as any).rotation === 'number' && !isNaN((config as any).rotation)) return (config as any).rotation
  if (typeof config.rotate === 'string') {
    const p = parseFloat(config.rotate)
    if (!isNaN(p)) return p
  }
  if (config.transform) {
    const match = config.transform.match(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*(?:deg)?\s*\)/i)
    if (match && match[1]) {
      const p = parseFloat(match[1])
      if (!isNaN(p)) return p
    }
  }
  return 0
}

interface BrandingCanvasEditorProps {
  brandingConfig: BrandingConfig | null
  onChange: (newConfig: BrandingConfig) => void
  productImage: string
  imageGallery: string[]
  isCustomizable: boolean
  onToggleCustomizable: (val: boolean) => void
}

const PRESETS = [
  { id: 'left_crest', label: 'Left Chest (Standard)', top: '49%', left: '60%', width: '16%', rotate: 0 },
  { id: 'right_crest', label: 'Right Chest', top: '49%', left: '40%', width: '16%', rotate: 0 },
  { id: 'chest', label: 'Center Chest (Below Buttons)', top: '57%', left: '50%', width: '22%', rotate: 0 },
  { id: 'vertical', label: 'Vertical 90°', top: '50%', left: '50%', width: '26%', rotate: 90 },
  { id: 'wrap', label: 'Horizontal Wrap', top: '48%', left: '50%', width: '32%', rotate: 0 },
  { id: 'full', label: 'Full Center', top: '50%', left: '50%', width: '40%', rotate: 0 },
]

export default function BrandingCanvasEditor({
  brandingConfig,
  onChange,
  productImage,
  imageGallery,
  isCustomizable,
  onToggleCustomizable,
}: BrandingCanvasEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Canvas State
  const [activeBackdrop, setActiveBackdrop] = useState<string>(productImage || imageGallery[0] || '')
  const [isDragging, setIsDragging] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [resizingSide, setResizingSide] = useState<'corner' | 'side' | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Preview Mode: outline | text | logo
  const [previewMode, setPreviewMode] = useState<'box' | 'text' | 'logo'>('box')
  const [sampleText, setSampleText] = useState('OUTFLANK')
  const [sampleTextColor, setSampleTextColor] = useState<'#1d1d1f' | '#ffffff' | '#e3231c'>('#1d1d1f')
  const [sampleLogoUrl, setSampleLogoUrl] = useState<string>('/logo/outflank-logo.png')

  // Available backdrop images
  const allImages = Array.from(new Set([productImage, ...imageGallery].filter(Boolean)))

  useEffect(() => {
    if (!activeBackdrop && (productImage || imageGallery[0])) {
      setActiveBackdrop(productImage || imageGallery[0])
    }
  }, [productImage, imageGallery, activeBackdrop])

  // Current parsed numeric values
  const currentLeft = parseFloat(brandingConfig?.left || '50')
  const currentTop = parseFloat(brandingConfig?.top || '50')
  const currentWidth = parseFloat(brandingConfig?.width || '25')
  const currentRotate = parseRotation(brandingConfig)

  // Helper to update rotation while keeping other properties
  const updateRotation = (newAngle: number) => {
    let norm = Math.round(newAngle)
    while (norm > 180) norm -= 360
    while (norm <= -180) norm += 360

    onChange({
      ...brandingConfig,
      left: brandingConfig?.left || '50%',
      top: brandingConfig?.top || '50%',
      width: brandingConfig?.width || '25%',
      rotate: norm,
      transform: norm !== 0
        ? `translate(-50%, -50%) rotate(${norm}deg)`
        : 'translate(-50%, -50%)',
    })
  }

  // Interactive Dragging on the Box
  const handleBoxPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return

    const canvasRect = canvas.getBoundingClientRect()
    const startClientX = e.clientX
    const startClientY = e.clientY
    const startLeft = currentLeft
    const startTop = currentTop

    setIsDragging(true)
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)

    const handlePointerMove = (moveEv: PointerEvent) => {
      const dx = ((moveEv.clientX - startClientX) / canvasRect.width) * 100
      const dy = ((moveEv.clientY - startClientY) / canvasRect.height) * 100

      let newLeft = Math.max(5, Math.min(95, startLeft + dx))
      let newTop = Math.max(5, Math.min(95, startTop + dy))

      // Snap to 50% center within 1.5%
      if (Math.abs(newLeft - 50) < 1.5) newLeft = 50
      if (Math.abs(newTop - 50) < 1.5) newTop = 50

      onChange({
        ...brandingConfig,
        left: `${Math.round(newLeft * 10) / 10}%`,
        top: `${Math.round(newTop * 10) / 10}%`,
        width: brandingConfig?.width || '25%',
        rotate: currentRotate,
        transform: currentRotate !== 0
          ? `translate(-50%, -50%) rotate(${currentRotate}deg)`
          : 'translate(-50%, -50%)',
      })
    }

    const handlePointerUp = (upEv: PointerEvent) => {
      setIsDragging(false)
      target.releasePointerCapture(upEv.pointerId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  // Interactive Rotation via Circular Handle Knob
  const handleRotatePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const box = boxRef.current
    if (!box) return

    const boxRect = box.getBoundingClientRect()
    const centerX = boxRect.left + boxRect.width / 2
    const centerY = boxRect.top + boxRect.height / 2

    setIsRotating(true)
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)

    const handlePointerMove = (moveEv: PointerEvent) => {
      const radians = Math.atan2(moveEv.clientY - centerY, moveEv.clientX - centerX)
      let degrees = Math.round(radians * (180 / Math.PI)) + 90

      while (degrees > 180) degrees -= 360
      while (degrees <= -180) degrees += 360

      if (moveEv.shiftKey) {
        degrees = Math.round(degrees / 15) * 15
      } else {
        const snaps = [0, 45, -45, 90, -90, 135, -135, 180, -180]
        for (const snap of snaps) {
          if (Math.abs(degrees - snap) <= 4) {
            degrees = snap === -180 ? 180 : snap
            break
          }
        }
      }

      updateRotation(degrees)
    }

    const handlePointerUp = (upEv: PointerEvent) => {
      setIsRotating(false)
      target.releasePointerCapture(upEv.pointerId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  // Resizing the Logo Box (Corner or Side handle)
  const handleResizePointerDown = (e: React.PointerEvent, isCorner: boolean) => {
    e.preventDefault()
    e.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return

    const canvasRect = canvas.getBoundingClientRect()
    const startClientX = e.clientX
    const startWidth = currentWidth

    setResizingSide(isCorner ? 'corner' : 'side')
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)

    const handlePointerMove = (moveEv: PointerEvent) => {
      const dx = ((moveEv.clientX - startClientX) / canvasRect.width) * 100 * 2
      const newWidth = Math.max(8, Math.min(85, startWidth + dx))

      onChange({
        ...brandingConfig,
        width: `${Math.round(newWidth * 10) / 10}%`,
        left: brandingConfig?.left || '50%',
        top: brandingConfig?.top || '50%',
        rotate: currentRotate,
        transform: currentRotate !== 0
          ? `translate(-50%, -50%) rotate(${currentRotate}deg)`
          : 'translate(-50%, -50%)',
      })
    }

    const handlePointerUp = (upEv: PointerEvent) => {
      setResizingSide(null)
      target.releasePointerCapture(upEv.pointerId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  // Clicking directly on canvas to reposition center
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasRect = canvas.getBoundingClientRect()
    let clickX = ((e.clientX - canvasRect.left) / canvasRect.width) * 100
    let clickY = ((e.clientY - canvasRect.top) / canvasRect.height) * 100

    if (Math.abs(clickX - 50) < 1.5) clickX = 50
    if (Math.abs(clickY - 50) < 1.5) clickY = 50

    onChange({
      ...brandingConfig,
      left: `${Math.round(clickX * 10) / 10}%`,
      top: `${Math.round(clickY * 10) / 10}%`,
      width: brandingConfig?.width || '25%',
      rotate: currentRotate,
      transform: currentRotate !== 0
        ? `translate(-50%, -50%) rotate(${currentRotate}deg)`
        : 'translate(-50%, -50%)',
    })
  }

  // Test Logo File Upload
  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setSampleLogoUrl(url)
      setPreviewMode('logo')
    }
  }

  const isSnappedX = Math.abs(currentLeft - 50) < 0.5
  const isSnappedY = Math.abs(currentTop - 50) < 0.5

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Enable Toggle Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-black/8 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
            <Paintbrush size={18} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[#1d1d1f]">3D Logo Studio & Custom Branding</h3>
            <p className="text-[12px] text-[#86868b]">Enables clients to interactively position and preview company logos on this product.</p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={isCustomizable}
          onChange={(e) => onToggleCustomizable(e.target.checked)}
          className="w-5 h-5 rounded text-[#0066FF] focus:ring-[#0066FF]/20 cursor-pointer"
        />
      </div>

      {!isCustomizable ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-black/5 text-[#86868b] text-[13px]">
          Turn on the switch above to activate visual logo placement for this product.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Placement Presets Bar - Clean, Minimal, No Emojis */}
          <div className="bg-white p-3.5 rounded-2xl border border-black/8 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                Standard Placements
              </span>
              <span className="text-[11px] text-[#86868b]">Select preset or adjust freely on canvas</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PRESETS.map((preset) => {
                const isSelected =
                  brandingConfig?.top === preset.top &&
                  brandingConfig?.left === preset.left &&
                  brandingConfig?.width === preset.width &&
                  currentRotate === (preset.rotate || 0)
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChange({
                      ...brandingConfig,
                      top: preset.top,
                      left: preset.left,
                      width: preset.width,
                      rotate: preset.rotate,
                      transform: preset.rotate !== 0
                        ? `translate(-50%, -50%) rotate(${preset.rotate}deg)`
                        : 'translate(-50%, -50%)',
                    })}
                    className={`py-2 px-3 rounded-xl border text-center text-[12px] font-semibold transition-all whitespace-nowrap ${
                      isSelected
                        ? 'border-[#0066FF] bg-[#0066FF]/5 text-[#0066FF] shadow-2xs ring-1 ring-[#0066FF]/20 font-bold'
                        : 'border-black/5 bg-[#fbfbfd] text-[#1d1d1f] hover:border-black/20 hover:bg-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ─── THE INTERACTIVE VISUAL CANVAS ─── */}
          <div className="bg-white rounded-2xl border border-black/8 shadow-md overflow-hidden flex flex-col">
            {/* Canvas Studio Toolbar */}
            <div className="p-3 bg-[#fbfbfd] border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-2.5 text-[12px]">
              {/* Left: Align & Size & Rotation Tools */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Alignment */}
                <div className="flex items-center bg-white p-1 rounded-xl border border-black/8 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => onChange({
                      ...brandingConfig,
                      left: '50%',
                      rotate: currentRotate,
                      transform: currentRotate !== 0 ? `translate(-50%, -50%) rotate(${currentRotate}deg)` : 'translate(-50%, -50%)',
                    })}
                    className="px-2 py-1 rounded-lg text-[#555] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors flex items-center gap-1 font-medium text-[11px]"
                    title="Center Horizontally (X)"
                  >
                    <AlignCenter size={13} />
                    <span className="hidden sm:inline">Center X</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({
                      ...brandingConfig,
                      top: '50%',
                      rotate: currentRotate,
                      transform: currentRotate !== 0 ? `translate(-50%, -50%) rotate(${currentRotate}deg)` : 'translate(-50%, -50%)',
                    })}
                    className="px-2 py-1 rounded-lg text-[#555] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors flex items-center gap-1 font-medium text-[11px]"
                    title="Center Vertically (Y)"
                  >
                    <AlignVerticalSpaceAround size={13} />
                    <span className="hidden sm:inline">Center Y</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({
                      ...brandingConfig,
                      top: '50%',
                      left: '50%',
                      width: '25%',
                      rotate: 0,
                      transform: 'translate(-50%, -50%)',
                    })}
                    className="p-1 rounded-lg text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                    title="Reset Position & Rotation (50%, 50%, 0°)"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>

                {/* Size Slider */}
                <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-black/8 shadow-2xs h-[32px]">
                  <span className="text-[11px] font-semibold text-[#86868b]">Size</span>
                  <input
                    type="range"
                    min="8"
                    max="70"
                    step="1"
                    value={currentWidth}
                    onChange={(e) => onChange({
                      ...brandingConfig,
                      width: `${e.target.value}%`,
                      rotate: currentRotate,
                      transform: currentRotate !== 0 ? `translate(-50%, -50%) rotate(${currentRotate}deg)` : 'translate(-50%, -50%)',
                    })}
                    className="w-16 sm:w-20 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#1d1d1f]"
                  />
                  <span className="text-[11px] font-mono font-bold text-[#1d1d1f] min-w-[28px] text-right">
                    {Math.round(currentWidth)}%
                  </span>
                </div>

                {/* Rotation Stepper & Slider */}
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-black/8 shadow-2xs h-[32px]">
                  <button
                    type="button"
                    onClick={() => updateRotation(currentRotate - 90)}
                    className="px-1.5 py-0.5 rounded-lg text-[#555] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] font-mono text-[11px] font-bold transition-colors flex items-center gap-0.5"
                    title="Rotate -90°"
                  >
                    <RotateCcw size={11} />
                    <span>-90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRotation(currentRotate + 90)}
                    className="px-1.5 py-0.5 rounded-lg text-[#555] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] font-mono text-[11px] font-bold transition-colors flex items-center gap-0.5"
                    title="Rotate +90°"
                  >
                    <RotateCw size={11} />
                    <span>+90°</span>
                  </button>
                  {currentRotate !== 0 && (
                    <button
                      type="button"
                      onClick={() => updateRotation(0)}
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
                      title="Reset angle to 0°"
                    >
                      0°
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 pl-1.5 border-l border-neutral-200">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={currentRotate}
                      onChange={(e) => updateRotation(Number(e.target.value))}
                      className="w-14 sm:w-16 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#1d1d1f]"
                      title="Rotate Angle (-180° to 180°)"
                    />
                    <span className={`text-[11px] font-mono font-bold min-w-[32px] text-right ${currentRotate !== 0 ? 'text-[#0066FF]' : 'text-[#1d1d1f]'}`}>
                      {currentRotate}°
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Preview Mode Switcher */}
              <div className="flex items-center bg-[#f0f0f2] p-0.5 rounded-xl border border-black/5 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setPreviewMode('box')}
                  className={`px-3 py-1 rounded-lg transition-all ${previewMode === 'box' ? 'bg-white shadow-2xs font-semibold text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                >
                  Outline
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('text')}
                  className={`px-3 py-1 rounded-lg transition-all ${previewMode === 'text' ? 'bg-white shadow-2xs font-semibold text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('logo')}
                  className={`px-3 py-1 rounded-lg transition-all ${previewMode === 'logo' ? 'bg-white shadow-2xs font-semibold text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                >
                  Test Logo
                </button>
              </div>
            </div>

            {/* Optional Mode Settings Bar (Text / Logo upload) */}
            {previewMode === 'text' && (
              <div className="px-4 py-2 bg-[#f0f0f2] border-b border-black/5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <span className="font-semibold text-[#86868b]">Sample Text:</span>
                  <input
                    type="text"
                    value={sampleText}
                    onChange={(e) => setSampleText(e.target.value)}
                    placeholder="e.g. ACME CORP"
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-black/10 font-bold uppercase text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#86868b]">Color:</span>
                  {[
                    { label: 'Dark', color: '#1d1d1f' as const },
                    { label: 'White', color: '#ffffff' as const },
                    { label: 'Red', color: '#e3231c' as const },
                  ].map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setSampleTextColor(c.color)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${sampleTextColor === c.color ? 'border-[#0066FF] scale-110 shadow-sm' : 'border-black/20'}`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {previewMode === 'logo' && (
              <div className="px-4 py-2 bg-[#f0f0f2] border-b border-black/5 flex items-center justify-between gap-3 text-xs">
                <span className="text-[#86868b]">Upload a sample transparent PNG logo to test fit:</span>
                <label className="cursor-pointer px-3 py-1 rounded-lg bg-white border border-black/10 hover:border-black/30 font-semibold text-[#1d1d1f] flex items-center gap-1.5 shadow-2xs">
                  <Upload size={12} /> Choose PNG
                  <input type="file" accept="image/*" onChange={handleCustomLogoUpload} className="hidden" />
                </label>
              </div>
            )}

            {/* Backdrop Angle Switcher (if product has multiple photos) */}
            {allImages.length > 1 && (
              <div className="px-4 py-2 bg-[#fbfbfd] border-b border-black/[0.06] flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider shrink-0 mr-1">
                  Product Angle:
                </span>
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveBackdrop(img)}
                    className={`relative w-8 h-8 rounded-lg overflow-hidden border transition-all shrink-0 ${
                      activeBackdrop === img ? 'ring-2 ring-[#0066FF] border-transparent scale-105 shadow-2xs' : 'border-black/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Image src={img} alt="" fill className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            )}

            {/* ─── CANVAS AREA ─── */}
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="relative w-full h-[460px] bg-gradient-to-b from-[#f8f8fa] to-[#ececed] overflow-hidden select-none cursor-crosshair flex items-center justify-center"
            >
              {/* Product Backdrop Image */}
              {activeBackdrop ? (
                <div className="relative w-full h-full p-6 pointer-events-none">
                  <Image
                    src={activeBackdrop}
                    alt="Product Canvas Backdrop"
                    fill
                    className="object-contain"
                    priority
                    unoptimized
                  />
                </div>
              ) : (
                <div className="text-center text-[#86868b] pointer-events-none">
                  <ImageIcon size={44} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold">Upload product photos to position logo</p>
                </div>
              )}

              {/* Center Crosshair Vertical Guide */}
              <div
                className={`absolute top-0 bottom-0 left-1/2 w-0 border-r border-dashed transition-colors pointer-events-none ${
                  isSnappedX ? 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] z-20' : 'border-black/10 z-10'
                }`}
              />

              {/* Center Crosshair Horizontal Guide */}
              <div
                className={`absolute left-0 right-0 top-1/2 h-0 border-b border-dashed transition-colors pointer-events-none ${
                  isSnappedY ? 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] z-20' : 'border-black/10 z-10'
                }`}
              />

              {/* ─── THE INTERACTIVE DRAGGABLE, ROTATABLE & RESIZABLE LOGO BOX ─── */}
              <div
                ref={boxRef}
                onPointerDown={handleBoxPointerDown}
                style={{
                  position: 'absolute',
                  top: `${currentTop}%`,
                  left: `${currentLeft}%`,
                  width: `${currentWidth}%`,
                  transform: currentRotate !== 0
                    ? `translate(-50%, -50%) rotate(${currentRotate}deg)`
                    : 'translate(-50%, -50%)',
                  transformOrigin: 'center center',
                }}
                className={`group z-30 select-none ${
                  isDragging || isRotating ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                {/* ─── ROTATION HANDLE (Stem & Knob) ─── */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-50 pointer-events-auto">
                  {/* Circular Knob */}
                  <div
                    onPointerDown={handleRotatePointerDown}
                    onDoubleClick={() => updateRotation(0)}
                    className={`w-3.5 h-3.5 rounded-full border border-white shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-125 transition-all ${
                      isRotating
                        ? 'bg-[#0066FF] ring-2 ring-[#0066FF]/40 scale-125'
                        : 'bg-[#0066FF] hover:bg-[#0052cc]'
                    }`}
                    title="Drag to rotate • Double-click to reset (0°)"
                  />
                  {/* Stem Line */}
                  <div className="w-px h-2.5 bg-[#0066FF]/60" />
                </div>

                {/* Live Precision Coordinates Badge (Floating above rotation handle) */}
                <div
                  className="absolute -top-12 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-neutral-900/90 backdrop-blur-md text-white text-[10px] font-mono font-medium whitespace-nowrap shadow-md pointer-events-none flex items-center gap-1.5 z-40 border border-white/10"
                  style={{ transform: currentRotate !== 0 ? `rotate(${-currentRotate}deg)` : undefined }}
                >
                  <span>X {Math.round(currentLeft)}%</span>
                  <span className="text-white/30">•</span>
                  <span>Y {Math.round(currentTop)}%</span>
                  <span className="text-white/30">•</span>
                  <span>W {Math.round(currentWidth)}%</span>
                  {currentRotate !== 0 && (
                    <>
                      <span className="text-white/30">•</span>
                      <span className="text-blue-300 font-semibold">{currentRotate}°</span>
                    </>
                  )}
                </div>

                {/* Bounding Box Container - Figma Style */}
                <div className="relative w-full aspect-[16/9] min-h-[44px] rounded-lg border-[1.5px] border-[#0066FF] bg-[#0066FF]/[0.05] backdrop-blur-[1px] flex items-center justify-center p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.4)]">
                  
                  {/* Content based on Preview Mode */}
                  {previewMode === 'box' && (
                    <div className="text-center pointer-events-none">
                      <span className="text-[10px] font-bold tracking-wider text-[#0066FF] uppercase">
                        IMPRINT AREA
                      </span>
                      {currentRotate !== 0 && (
                        <span className="block text-[9px] text-neutral-500 font-mono mt-0.5">
                          {currentRotate}°
                        </span>
                      )}
                    </div>
                  )}

                  {previewMode === 'text' && (
                    <div
                      className="font-bold text-center uppercase tracking-wider drop-shadow-sm pointer-events-none select-none w-full truncate"
                      style={{
                        color: sampleTextColor,
                        fontSize: `clamp(11px, ${currentWidth * 0.38}px, 28px)`,
                      }}
                    >
                      {sampleText || 'COMPANY LOGO'}
                    </div>
                  )}

                  {previewMode === 'logo' && (
                    <div className="relative w-full h-full pointer-events-none flex items-center justify-center">
                      <img
                        src={sampleLogoUrl}
                        alt="Test Logo"
                        className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                      />
                    </div>
                  )}

                  {/* Center Dot Crosshair */}
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0066FF] shadow-xs pointer-events-none" />

                  {/* 4 Professional Square Corner Handles (Figma Style) */}
                  <div
                    onPointerDown={(e) => handleResizePointerDown(e, true)}
                    className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-[#0066FF] shadow-xs cursor-nwse-resize hover:scale-125 transition-transform z-40 rounded-[2px]"
                    title="Resize"
                  />
                  <div
                    onPointerDown={(e) => handleResizePointerDown(e, true)}
                    className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-[#0066FF] shadow-xs cursor-nesw-resize hover:scale-125 transition-transform z-40 rounded-[2px]"
                    title="Resize"
                  />
                  <div
                    onPointerDown={(e) => handleResizePointerDown(e, true)}
                    className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-[#0066FF] shadow-xs cursor-nesw-resize hover:scale-125 transition-transform z-40 rounded-[2px]"
                    title="Resize"
                  />
                  <div
                    onPointerDown={(e) => handleResizePointerDown(e, true)}
                    className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-[#0066FF] shadow-xs cursor-nwse-resize hover:scale-125 transition-transform z-40 rounded-[2px]"
                    title="Resize"
                  />

                  {/* Side Edge Handles */}
                  <div
                    onPointerDown={(e) => handleResizePointerDown(e, false)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-4 bg-white border border-[#0066FF] shadow-xs cursor-ew-resize hover:scale-125 transition-transform z-40 rounded-full"
                    title="Adjust Width"
                  />
                  <div
                    onPointerDown={(e) => handleResizePointerDown(e, false)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1.5 h-4 bg-white border border-[#0066FF] shadow-xs cursor-ew-resize hover:scale-125 transition-transform z-40 rounded-full"
                    title="Adjust Width"
                  />
                </div>
              </div>
            </div>

            {/* Canvas Footer Bar */}
            <div className="px-4 py-2.5 bg-[#fbfbfd] border-t border-black/[0.06] flex items-center justify-between text-[11px] text-[#86868b]">
              <div className="flex items-center gap-1.5 font-medium">
                <Move size={12} className="text-[#0066FF]" />
                <span>Drag box to position • Drag top knob or use -90° / +90° to rotate</span>
              </div>

              {/* Advanced Values Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 font-semibold text-[#1d1d1f] hover:text-[#0066FF] transition-colors"
              >
                {showAdvanced ? 'Hide Coordinates' : 'Manual Coordinates'}
                {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {/* Expandable Manual Values Inputs */}
            {showAdvanced && (
              <div className="p-4 bg-white border-t border-black/[0.06] space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#86868b] uppercase mb-1">Top Offset (Y)</label>
                    <input
                      type="text"
                      value={brandingConfig?.top || '50%'}
                      onChange={(e) => onChange({
                        ...brandingConfig,
                        top: e.target.value,
                        rotate: currentRotate,
                        transform: currentRotate !== 0 ? `translate(-50%, -50%) rotate(${currentRotate}deg)` : 'translate(-50%, -50%)',
                      })}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#f5f5f7] border border-black/5 text-[13px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#86868b] uppercase mb-1">Left Offset (X)</label>
                    <input
                      type="text"
                      value={brandingConfig?.left || '50%'}
                      onChange={(e) => onChange({
                        ...brandingConfig,
                        left: e.target.value,
                        rotate: currentRotate,
                        transform: currentRotate !== 0 ? `translate(-50%, -50%) rotate(${currentRotate}deg)` : 'translate(-50%, -50%)',
                      })}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#f5f5f7] border border-black/5 text-[13px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#86868b] uppercase mb-1">Width Size</label>
                    <input
                      type="text"
                      value={brandingConfig?.width || '25%'}
                      onChange={(e) => onChange({
                        ...brandingConfig,
                        width: e.target.value,
                        rotate: currentRotate,
                        transform: currentRotate !== 0 ? `translate(-50%, -50%) rotate(${currentRotate}deg)` : 'translate(-50%, -50%)',
                      })}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#f5f5f7] border border-black/5 text-[13px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#86868b] uppercase mb-1">Rotation (Deg)</label>
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      value={currentRotate}
                      onChange={(e) => updateRotation(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#f5f5f7] border border-black/5 text-[13px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#86868b] uppercase mb-1">Transform CSS</label>
                    <input
                      type="text"
                      value={brandingConfig?.transform || 'translate(-50%, -50%)'}
                      onChange={(e) => onChange({ ...brandingConfig, transform: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#f5f5f7] border border-black/5 text-[13px] font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
