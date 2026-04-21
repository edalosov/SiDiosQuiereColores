import {
  useRef, useEffect, useCallback, useState,
  type FC, type WheelEvent, type MouseEvent as RMouseEvent,
} from 'react'
import type { Cluster, NoiseSettings } from '../types'
import { applyNoise } from '../utils/noise'

interface Props {
  imageData: ImageData
  clusterMap: Uint8Array
  clusters: Cluster[]
  selectedCluster: number | null
  showOriginal: boolean
  noiseSettings: NoiseSettings
  noiseMap: Float32Array | null
  onSelectCluster: (id: number) => void
}

const ImageCanvas: FC<Props> = ({
  imageData, clusterMap, clusters, selectedCluster, showOriginal,
  noiseSettings, noiseMap,
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

    // Step 1 — apply cluster colors
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

    // Step 2 — apply noise on top (skips transparent/hidden pixels)
    if (noiseSettings.enabled && noiseSettings.amount > 0 && noiseMap) {
      applyNoise(dst, noiseMap, noiseSettings)
    }

    ctx.putImageData(out, 0, 0)
  }, [imageData, clusterMap, clusters, showOriginal, noiseSettings, noiseMap])

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

  // Selection highlight — renders then brightens selected cluster pixels
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || selectedCluster === null) return
    const ctx = canvas.getContext('2d')!
    render()

    const out = ctx.getImageData(0, 0, imageData.width, imageData.height)
    const n = imageData.width * imageData.height
    for (let i = 0; i < n; i++) {
      if (clusterMap[i] === selectedCluster) {
        const pi = i * 4
        out.data[pi]     = Math.min(255, out.data[pi]     + 40)
        out.data[pi + 1] = Math.min(255, out.data[pi + 1] + 40)
        out.data[pi + 2] = Math.min(255, out.data[pi + 2] + 40)
      }
    }
    ctx.putImageData(out, 0, 0)
  }, [selectedCluster, render, clusterMap, imageData])

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

  // Click to select cluster
  const handleClick = (e: RMouseEvent) => {
    if (didPan.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    const cx = Math.floor((e.clientX - rect.left - pan.x) / zoom)
    const cy = Math.floor((e.clientY - rect.top - pan.y) / zoom)
    if (cx < 0 || cx >= imageData.width || cy < 0 || cy >= imageData.height) return
    onSelectCluster(clusterMap[cy * imageData.width + cx])
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
        Scroll to zoom · Middle-click drag to pan · Click image to select cluster
      </div>
    </div>
  )
}

export default ImageCanvas
