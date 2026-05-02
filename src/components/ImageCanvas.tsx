import {
  useRef, useEffect, useCallback, useState,
  type FC, type WheelEvent, type MouseEvent as RMouseEvent,
} from 'react'
import type { Cluster, NoiseSettings, RGBColor, TextOverlay, ToolMode } from '../types'
import { applyNoise } from '../utils/noise'
import { loadGoogleFont } from '../utils/fonts'
import { drawTextOverlay } from '../utils/textDraw'

interface Props {
  imageData: ImageData
  clusterMap: Uint8Array
  clusters: Cluster[]
  selectedCluster: number | null
  showOriginal: boolean
  noiseSettings: NoiseSettings
  noiseMap: Float32Array | null
  textOverlay: TextOverlay
  toolMode: ToolMode
  lassoColor: RGBColor
  pixelOverrides: Map<number, number>
  onSelectCluster: (id: number | null) => void
  onLassoFill: (overrides: Map<number, number>) => void
}

function buildLUT(clusters: Cluster[]): Uint32Array {
  const lut = new Uint32Array(clusters.length)
  clusters.forEach((c, i) => {
    if (c.visible) {
      const { r, g, b } = c.currentColor
      lut[i] = (255 << 24) | (b << 16) | (g << 8) | r
    }
  })
  return lut
}

const ImageCanvas: FC<Props> = ({
  imageData, clusterMap, clusters, selectedCluster, showOriginal,
  noiseSettings, noiseMap, textOverlay,
  toolMode, lassoColor, pixelOverrides,
  onSelectCluster, onLassoFill,
}) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const overlayRef   = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan]   = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart       = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const didPan         = useRef(false)
  const isLassoingRef  = useRef(false)
  const lassoPathRef   = useRef<{ x: number; y: number }[]>([])
  // Keep latest pan/zoom accessible in ref-based lasso callbacks
  const zoomRef = useRef(zoom)
  const panRef  = useRef(pan)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan },   [pan])

  // ── Render ────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    if (showOriginal) { ctx.putImageData(imageData, 0, 0); return }

    const out     = new ImageData(imageData.width, imageData.height)
    const outView = new Uint32Array(out.data.buffer)
    const lut     = buildLUT(clusters)
    const n       = imageData.width * imageData.height

    for (let i = 0; i < n; i++) outView[i] = lut[clusterMap[i]]

    // Pixel-level overrides (lasso fills) on top of cluster colors
    for (const [idx, color] of pixelOverrides) outView[idx] = color

    const hasText  = textOverlay.enabled && textOverlay.content.trim().length > 0
    const hasNoise = noiseSettings.enabled && noiseSettings.amount > 0 && noiseMap

    if (hasText) {
      ctx.putImageData(out, 0, 0)
      drawTextOverlay(ctx, textOverlay, imageData.width, imageData.height)
      if (hasNoise) {
        const withText = ctx.getImageData(0, 0, imageData.width, imageData.height)
        applyNoise(withText.data, noiseMap!, noiseSettings)
        ctx.putImageData(withText, 0, 0)
      }
    } else {
      if (hasNoise) applyNoise(out.data, noiseMap!, noiseSettings)
      ctx.putImageData(out, 0, 0)
    }
  }, [imageData, clusterMap, clusters, showOriginal, noiseSettings, noiseMap, textOverlay, pixelOverrides])

  const renderRef = useRef(render)
  useEffect(() => { renderRef.current = render }, [render])

  useEffect(() => {
    if (!textOverlay.enabled) return
    loadGoogleFont(textOverlay.fontFamily).then(() => renderRef.current())
  }, [textOverlay.fontFamily, textOverlay.enabled])

  // ── Fit to container ─────────────────────────────────────────
  const resetView = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    const scale = Math.min(cw / imageData.width, ch / imageData.height, 1) * 0.9
    setZoom(scale)
    setPan({ x: (cw - imageData.width * scale) / 2, y: (ch - imageData.height * scale) / 2 })
  }, [imageData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = imageData.width
    canvas.height = imageData.height
    resetView()
  }, [imageData, resetView])

  useEffect(() => { render() }, [render])

  // ── Resize overlay canvas to match container ─────────────────
  useEffect(() => {
    if (toolMode !== 'lasso') return
    const overlay   = overlayRef.current
    const container = containerRef.current
    if (overlay && container) {
      overlay.width  = container.clientWidth
      overlay.height = container.clientHeight
    }
  }, [toolMode])

  // Clear overlay when leaving lasso mode
  useEffect(() => {
    if (toolMode === 'lasso') return
    const overlay = overlayRef.current
    if (overlay) overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height)
    isLassoingRef.current = false
    lassoPathRef.current  = []
  }, [toolMode])

  // ── Zoom ──────────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const rect   = containerRef.current!.getBoundingClientRect()
    const mx     = e.clientX - rect.left
    const my     = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const newZoom = Math.max(0.05, Math.min(30, zoom * factor))
    setPan(p => ({
      x: mx - ((mx - p.x) / zoom) * newZoom,
      y: my - ((my - p.y) / zoom) * newZoom,
    }))
    setZoom(newZoom)
  }, [zoom])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const h = (e: Event) => handleWheel(e as unknown as WheelEvent)
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [handleWheel])

  // ── Lasso helpers ─────────────────────────────────────────────
  const toImageCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top  - panRef.current.y) / zoomRef.current,
    }
  }

  const drawLassoOverlay = (path: { x: number; y: number }[]) => {
    const overlay = overlayRef.current
    if (!overlay || path.length < 2) return
    const ctx = overlay.getContext('2d')!
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    const z = zoomRef.current
    const p = panRef.current
    const pts = path.map(pt => ({ x: pt.x * z + p.x, y: pt.y * z + p.y }))

    const stroke = (lw: number, color: string) => {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.lineTo(pts[0].x, pts[0].y)
      ctx.strokeStyle = color
      ctx.lineWidth   = lw
      ctx.setLineDash([])
      ctx.stroke()
    }
    stroke(2.5, 'rgba(0,0,0,0.55)')
    stroke(1.5, 'rgba(255,255,255,0.9)')
  }

  const completeLasso = useCallback(() => {
    const path    = lassoPathRef.current
    const overlay = overlayRef.current
    if (overlay) overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height)

    if (path.length < 3) { lassoPathRef.current = []; return }

    // Bounding box in image space
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const pt of path) {
      if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x
      if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y
    }
    const x0 = Math.max(0, Math.floor(minX))
    const y0 = Math.max(0, Math.floor(minY))
    const x1 = Math.min(imageData.width  - 1, Math.ceil(maxX))
    const y1 = Math.min(imageData.height - 1, Math.ceil(maxY))
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    if (bw <= 0 || bh <= 0) { lassoPathRef.current = []; return }

    // Fill the polygon on a small offscreen canvas
    const off = document.createElement('canvas')
    off.width = bw; off.height = bh
    const ctx = off.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(path[0].x - x0, path[0].y - y0)
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x - x0, path[i].y - y0)
    ctx.closePath()
    ctx.fill()

    const filled = ctx.getImageData(0, 0, bw, bh)
    const { r, g, b } = lassoColor
    const packed = (255 << 24) | (b << 16) | (g << 8) | r

    const newOverrides = new Map<number, number>()
    for (let ly = 0; ly < bh; ly++) {
      for (let lx = 0; lx < bw; lx++) {
        if (filled.data[(ly * bw + lx) * 4 + 3] > 0) {
          newOverrides.set((y0 + ly) * imageData.width + (x0 + lx), packed)
        }
      }
    }

    lassoPathRef.current = []
    if (newOverrides.size > 0) onLassoFill(newOverrides)
  }, [imageData, lassoColor, onLassoFill])

  // ── Mouse handlers ────────────────────────────────────────────
  const handleMouseDown = (e: RMouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      didPan.current = false
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    } else if (e.button === 0 && toolMode === 'lasso') {
      // Ensure overlay is correctly sized
      const overlay   = overlayRef.current
      const container = containerRef.current
      if (overlay && container) {
        overlay.width  = container.clientWidth
        overlay.height = container.clientHeight
      }
      isLassoingRef.current = true
      lassoPathRef.current  = [toImageCoords(e.clientX, e.clientY)]
    }
  }

  const handleMouseMove = (e: RMouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.current.mx
      const dy = e.clientY - panStart.current.my
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPan.current = true
      setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy })
    }
    if (isLassoingRef.current) {
      const pt   = toImageCoords(e.clientX, e.clientY)
      const path = lassoPathRef.current
      const last = path[path.length - 1]
      // Only add if moved at least 1px in image space
      if (!last || (pt.x - last.x) ** 2 + (pt.y - last.y) ** 2 >= 1) {
        path.push(pt)
        drawLassoOverlay(path)
      }
    }
  }

  const handleMouseUp = (e: RMouseEvent) => {
    if (e.button === 1) setIsPanning(false)
    if (e.button === 0 && isLassoingRef.current) {
      isLassoingRef.current = false
      completeLasso()
    }
  }

  const handleClick = (e: RMouseEvent) => {
    if (toolMode === 'lasso') return
    if (didPan.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    const cx   = Math.floor((e.clientX - rect.left - pan.x) / zoom)
    const cy   = Math.floor((e.clientY - rect.top  - pan.y) / zoom)
    if (cx < 0 || cx >= imageData.width || cy < 0 || cy >= imageData.height) return
    const clicked = clusterMap[cy * imageData.width + cx]
    onSelectCluster(clicked === selectedCluster ? null : clicked)
  }

  const imageRendering = zoom >= 1 ? 'pixelated' : 'auto'
  const cursor = toolMode === 'lasso'
    ? (isLassoingRef.current ? 'crosshair' : 'cell')
    : (isPanning ? 'grabbing' : 'crosshair')

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      style={{ cursor }}
    >
      <div
        className="canvas-transform"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        <canvas ref={canvasRef} className="main-canvas" style={{ imageRendering }} />
      </div>

      {/* Lasso path overlay — screen-space, no transform */}
      {toolMode === 'lasso' && (
        <canvas ref={overlayRef} className="lasso-overlay" />
      )}

      <button className="canvas-reset-btn" onClick={resetView} title="Reset view">
        <ResetViewIcon />
      </button>
      <div className="canvas-hint">
        {toolMode === 'lasso'
          ? 'Draw to fill · Hold and drag to select area'
          : 'Scroll to zoom · Middle-click drag to pan · Click to select · Esc to deselect'}
      </div>
    </div>
  )
}

function ResetViewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3h7v7H3z" /><path d="M14 3h7v7h-7z" /><path d="M14 14h7v7h-7z" /><path d="M3 14h7v7H3z" />
    </svg>
  )
}

export default ImageCanvas
