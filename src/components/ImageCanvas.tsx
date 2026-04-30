import {
  useRef, useEffect, useCallback, useState,
  type FC, type WheelEvent, type MouseEvent as RMouseEvent,
} from 'react'
import type { Cluster, NoiseSettings, TextOverlay } from '../types'
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
  onSelectCluster: (id: number | null) => void
}

// Build a 32-bit ARGB lookup table for each cluster (little-endian: ABGR in memory = RGBA bytes).
// Writing one Uint32 per pixel is ~4x faster than four separate byte writes.
function buildLUT(clusters: Cluster[]): Uint32Array {
  const lut = new Uint32Array(clusters.length)
  clusters.forEach((c, i) => {
    if (c.visible) {
      const { r, g, b } = c.currentColor
      lut[i] = (255 << 24) | (b << 16) | (g << 8) | r
    }
    // invisible → 0 (transparent)
  })
  return lut
}

const ImageCanvas: FC<Props> = ({
  imageData, clusterMap, clusters, selectedCluster, showOriginal,
  noiseSettings, noiseMap, textOverlay,
  onSelectCluster,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const didPan = useRef(false)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    if (showOriginal) {
      ctx.putImageData(imageData, 0, 0)
      return
    }

    const out = new ImageData(imageData.width, imageData.height)
    const outView = new Uint32Array(out.data.buffer)
    const lut = buildLUT(clusters)
    const n = imageData.width * imageData.height

    for (let i = 0; i < n; i++) {
      outView[i] = lut[clusterMap[i]]
    }

    const hasText = textOverlay.enabled && textOverlay.content.trim().length > 0
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
  }, [imageData, clusterMap, clusters, showOriginal, noiseSettings, noiseMap, textOverlay])

  const renderRef = useRef(render)
  useEffect(() => { renderRef.current = render }, [render])

  // Preload font and re-render when font family changes
  useEffect(() => {
    if (!textOverlay.enabled) return
    loadGoogleFont(textOverlay.fontFamily).then(() => renderRef.current())
  }, [textOverlay.fontFamily, textOverlay.enabled])

  const resetView = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    const scale = Math.min(cw / imageData.width, ch / imageData.height, 1) * 0.9
    setZoom(scale)
    setPan({
      x: (cw - imageData.width * scale) / 2,
      y: (ch - imageData.height * scale) / 2,
    })
  }, [imageData])

  // Set canvas size on image change and fit to container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = imageData.width
    canvas.height = imageData.height
    resetView()
  }, [imageData, resetView])

  useEffect(() => { render() }, [render])

  // Zoom on scroll, centered at cursor
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
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
    const handler = (e: Event) => handleWheel(e as unknown as WheelEvent)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [handleWheel])

  const handleMouseDown = (e: RMouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      didPan.current = false
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    }
  }

  const handleMouseMove = (e: RMouseEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panStart.current.mx
    const dy = e.clientY - panStart.current.my
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPan.current = true
    setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy })
  }

  const handleMouseUp = (e: RMouseEvent) => {
    if (e.button === 1) setIsPanning(false)
  }

  const handleClick = (e: RMouseEvent) => {
    if (didPan.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    const cx = Math.floor((e.clientX - rect.left - pan.x) / zoom)
    const cy = Math.floor((e.clientY - rect.top - pan.y) / zoom)
    if (cx < 0 || cx >= imageData.width || cy < 0 || cy >= imageData.height) return
    const clicked = clusterMap[cy * imageData.width + cx]
    onSelectCluster(clicked === selectedCluster ? null : clicked)
  }

  // Pixelated rendering only when zoomed in past 100% — smooth downsampling otherwise
  const imageRendering = zoom >= 1 ? 'pixelated' : 'auto'

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
    >
      <div
        className="canvas-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <canvas ref={canvasRef} className="main-canvas" style={{ imageRendering }} />
      </div>
      <button className="canvas-reset-btn" onClick={resetView} title="Reset view">
        <ResetViewIcon />
      </button>
      <div className="canvas-hint">
        Scroll to zoom · Middle-click drag to pan · Click to select · Click again or Esc to deselect
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
