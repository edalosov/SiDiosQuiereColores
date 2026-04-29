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
    const src = imageData.data
    const dst = out.data
    const n = imageData.width * imageData.height

    for (let i = 0; i < n; i++) {
      const ci = clusterMap[i]
      const cluster = clusters[ci]
      const pi = i * 4
      if (!cluster || !cluster.visible) {
        dst[pi] = 0; dst[pi + 1] = 0; dst[pi + 2] = 0; dst[pi + 3] = 0
      } else {
        dst[pi]     = cluster.currentColor.r
        dst[pi + 1] = cluster.currentColor.g
        dst[pi + 2] = cluster.currentColor.b
        dst[pi + 3] = src[pi + 3]
      }
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
      if (hasNoise) applyNoise(dst, noiseMap!, noiseSettings)
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

  // Set canvas size on image change and fit to container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = imageData.width
    canvas.height = imageData.height

    const container = containerRef.current
    if (container) {
      const cw = container.clientWidth
      const ch = container.clientHeight
      const scale = Math.min(cw / imageData.width, ch / imageData.height, 1) * 0.9
      setZoom(scale)
      setPan({
        x: (cw - imageData.width * scale) / 2,
        y: (ch - imageData.height * scale) / 2,
      })
    }
  }, [imageData])

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

  // Pan with middle mouse button
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

  // Click: select cluster, or deselect if clicking the already-selected one
  const handleClick = (e: RMouseEvent) => {
    if (didPan.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    const cx = Math.floor((e.clientX - rect.left - pan.x) / zoom)
    const cy = Math.floor((e.clientY - rect.top - pan.y) / zoom)
    if (cx < 0 || cx >= imageData.width || cy < 0 || cy >= imageData.height) return
    const clicked = clusterMap[cy * imageData.width + cx]
    onSelectCluster(clicked === selectedCluster ? null : clicked)
  }

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
        <canvas ref={canvasRef} className="main-canvas" />
      </div>
      <div className="canvas-hint">
        Scroll to zoom · Middle-click drag to pan · Click to select · Click again or Esc to deselect
      </div>
    </div>
  )
}

export default ImageCanvas
