import { useEffect, useRef, useState, useCallback } from 'react'
import type { Cluster, ClusterSnapshot, ColorFormat, NoiseSettings, RGBColor, TextOverlay } from './types'
import { generateNoiseMap, applyNoise } from './utils/noise'
import { drawTextOverlay } from './utils/textDraw'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import ImageCanvas from './components/ImageCanvas'
import ImageUpload from './components/ImageUpload'

const DEFAULT_NOISE: NoiseSettings = {
  enabled: false,
  type: 'grain',
  amount: 20,
  scale: 1,
}

const DEFAULT_TEXT_OVERLAY: TextOverlay = {
  enabled: false,
  content: '',
  fontFamily: 'Inter',
  fontSize: 48,
  color: { r: 255, g: 255, b: 255 },
  marginX: 20,
  marginY: 20,
  anchor: 'bottom-left',
}

export default function App() {
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [clusterCount, setClusterCount] = useState(5)
  const [clusterMap, setClusterMap] = useState<Uint8Array | null>(null)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null)
  const [colorFormat, setColorFormat] = useState<ColorFormat>('HEX')
  const [showOriginal, setShowOriginal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Noise
  const [noiseSettings, setNoiseSettings] = useState<NoiseSettings>(DEFAULT_NOISE)
  const [noiseMap, setNoiseMap] = useState<Float32Array | null>(null)

  // Text overlay
  const [textOverlay, setTextOverlay] = useState<TextOverlay>(DEFAULT_TEXT_OVERLAY)

  // History for undo/redo
  const [historyStack, setHistoryStack] = useState<ClusterSnapshot[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const workerRef = useRef<Worker | null>(null)
  const clustersRef = useRef<Cluster[]>(clusters)
  useEffect(() => { clustersRef.current = clusters }, [clusters])

  // Regenerate noise map when image is loaded or type/scale changes
  const regenerateNoise = useCallback((
    data: ImageData,
    settings: NoiseSettings,
  ) => {
    const map = generateNoiseMap(data.width, data.height, settings.type, settings.scale)
    setNoiseMap(map)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); handleRedo()
      }
      if (e.key === 'Escape') setSelectedCluster(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyStack.length - 1

  const snapshotFromClusters = (cs: Cluster[]): ClusterSnapshot =>
    cs.map(c => ({ id: c.id, currentColor: c.currentColor, visible: c.visible }))

  const pushHistory = useCallback((cs: Cluster[]) => {
    const snap = snapshotFromClusters(cs)
    setHistoryStack(prev => [...prev.slice(0, historyIndex + 1), snap])
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const restoreSnapshot = (snap: ClusterSnapshot) => {
    setClusters(prev => prev.map(c => {
      const s = snap.find(e => e.id === c.id)
      return s ? { ...c, currentColor: s.currentColor, visible: s.visible } : c
    }))
  }

  const handleUndo = () => {
    if (historyIndex <= 0) return
    const ni = historyIndex - 1
    setHistoryIndex(ni)
    restoreSnapshot(historyStack[ni])
  }

  const handleRedo = () => {
    if (historyIndex >= historyStack.length - 1) return
    const ni = historyIndex + 1
    setHistoryIndex(ni)
    restoreSnapshot(historyStack[ni])
  }

  const runClustering = useCallback((data: ImageData, k: number) => {
    if (workerRef.current) workerRef.current.terminate()

    setIsProcessing(true)
    setSelectedCluster(null)

    const worker = new Worker(
      new URL('./workers/kmeans.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e) => {
      const { clusterMap: map, centroids, pixelCounts } = e.data as {
        clusterMap: Uint8Array
        centroids: [number, number, number][]
        pixelCounts: Uint32Array
      }

      const newClusters: Cluster[] = centroids.map((c, i) => ({
        id: i,
        originalColor: { r: c[0], g: c[1], b: c[2] },
        currentColor:  { r: c[0], g: c[1], b: c[2] },
        visible: true,
        pixelCount: pixelCounts[i],
      }))

      setClusterMap(map)
      setClusters(newClusters)
      setIsProcessing(false)

      const snap = snapshotFromClusters(newClusters)
      setHistoryStack([snap])
      setHistoryIndex(0)

      worker.terminate()
      workerRef.current = null
    }

    worker.onerror = () => {
      setIsProcessing(false)
      workerRef.current = null
    }

    worker.postMessage({ pixels: data.data, width: data.width, height: data.height, k })
  }, [])

  const handleImage = (_img: HTMLImageElement, data: ImageData) => {
    setImageData(data)
    runClustering(data, clusterCount)
    regenerateNoise(data, noiseSettings)
  }

  const handleClusterCountChange = (n: number) => {
    setClusterCount(n)
    if (imageData) runClustering(imageData, n)
  }

  const handleReRun = () => {
    if (imageData) runClustering(imageData, clusterCount)
  }

  const handleColorChange = (id: number, color: RGBColor) => {
    setClusters(prev => prev.map(c => c.id === id ? { ...c, currentColor: color } : c))
  }

  const handleColorCommit = () => { pushHistory(clustersRef.current) }

  const handleToggleVisibility = (id: number) => {
    setClusters(prev => {
      const next = prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c)
      pushHistory(next)
      return next
    })
  }

  const handleNoiseSettingsChange = (s: NoiseSettings) => {
    setNoiseSettings(s)
  }

  // Accepts the exact new settings so it never reads stale state from the closure
  const handleNoiseRegenerate = useCallback((s: NoiseSettings) => {
    if (imageData) regenerateNoise(imageData, s)
  }, [imageData, regenerateNoise])

  // Download — applies cluster colors + text overlay + noise, same as canvas render
  const handleDownload = (format: 'png' | 'jpeg') => {
    if (!imageData || !clusterMap || !clusters.length) return

    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!
    const out = new ImageData(imageData.width, imageData.height)
    const n = imageData.width * imageData.height

    for (let i = 0; i < n; i++) {
      const ci = clusterMap[i]
      const cluster = clusters[ci]
      const pi = i * 4
      if (!cluster || !cluster.visible) {
        if (format === 'jpeg') {
          out.data[pi] = 255; out.data[pi + 1] = 255; out.data[pi + 2] = 255; out.data[pi + 3] = 255
        }
      } else {
        out.data[pi]     = cluster.currentColor.r
        out.data[pi + 1] = cluster.currentColor.g
        out.data[pi + 2] = cluster.currentColor.b
        out.data[pi + 3] = 255
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
      if (hasNoise) applyNoise(out.data, noiseMap!, noiseSettings)
      ctx.putImageData(out, 0, 0)
    }

    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recolored.${format === 'jpeg' ? 'jpg' : 'png'}`
      a.click()
      URL.revokeObjectURL(url)
    }, `image/${format}`, 0.95)
  }

  const totalPixels = imageData ? imageData.width * imageData.height : 0

  return (
    <div className="app">
      <Toolbar
        hasImage={!!imageData}
        showOriginal={showOriginal}
        onToggleOriginal={() => setShowOriginal(v => !v)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDownload={handleDownload}
      />
      <div className="main">
        <Sidebar
          clusters={clusters}
          selectedCluster={selectedCluster}
          colorFormat={colorFormat}
          clusterCount={clusterCount}
          isProcessing={isProcessing}
          totalPixels={totalPixels}
          noiseSettings={noiseSettings}
          textOverlay={textOverlay}
          onSelectCluster={setSelectedCluster}
          onToggleVisibility={handleToggleVisibility}
          onColorChange={handleColorChange}
          onColorCommit={handleColorCommit}
          onColorFormatChange={setColorFormat}
          onClusterCountChange={handleClusterCountChange}
          onReRun={handleReRun}
          onNoiseSettingsChange={handleNoiseSettingsChange}
          onNoiseRegenerate={handleNoiseRegenerate}
          onTextOverlayChange={setTextOverlay}
        />
        <div className="canvas-area">
          {imageData && clusterMap && clusters.length > 0 ? (
            <ImageCanvas
              imageData={imageData}
              clusterMap={clusterMap}
              clusters={clusters}
              selectedCluster={selectedCluster}
              showOriginal={showOriginal}
              noiseSettings={noiseSettings}
              noiseMap={noiseMap}
              textOverlay={textOverlay}
              onSelectCluster={setSelectedCluster}
            />
          ) : (
            <ImageUpload onImage={handleImage} />
          )}
        </div>
      </div>
    </div>
  )
}
