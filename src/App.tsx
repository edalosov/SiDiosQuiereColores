import { useEffect, useRef, useState, useCallback } from 'react'
import type { Cluster, ClusterSnapshot, ColorFormat, NoiseSettings, RGBColor, TextOverlay, ToolMode } from './types'
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

// Match new clusters to old ones by nearest original brightness, restore custom colors.
function preserveColors(prev: Cluster[], next: Cluster[]): Cluster[] {
  return next.map(nc => {
    const nl = (nc.originalColor.r + nc.originalColor.g + nc.originalColor.b) / 3
    let best = prev[0]
    let bestDist = Infinity
    for (const oc of prev) {
      const d = Math.abs((oc.originalColor.r + oc.originalColor.g + oc.originalColor.b) / 3 - nl)
      if (d < bestDist) { bestDist = d; best = oc }
    }
    const { r: or, g: og, b: ob } = best.originalColor
    const { r: cr, g: cg, b: cb } = best.currentColor
    // Only restore if the user actually changed the color from its original
    if (cr === or && cg === og && cb === ob) return nc
    return { ...nc, currentColor: best.currentColor }
  })
}

export default function App() {
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [clusterCount, setClusterCount] = useState(5)
  const [clusterMap, setClusterMap] = useState<Uint8Array | null>(null)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null)
  const [colorFormat, setColorFormat] = useState<ColorFormat>('HEX')
  const [showOriginal, setShowOriginal] = useState(false)
  const [splitView, setSplitView] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Noise
  const [noiseSettings, setNoiseSettings] = useState<NoiseSettings>(DEFAULT_NOISE)
  const [noiseMap, setNoiseMap] = useState<Float32Array | null>(null)

  // Text overlay
  const [textOverlay, setTextOverlay] = useState<TextOverlay>(DEFAULT_TEXT_OVERLAY)

  // Lasso tool
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [lassoColor, setLassoColor] = useState<RGBColor>({ r: 255, g: 255, b: 255 })
  const [pixelOverrides, setPixelOverrides] = useState<Map<number, number>>(new Map())

  // History for undo/redo
  const [historyStack, setHistoryStack] = useState<ClusterSnapshot[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const workerRef = useRef<Worker | null>(null)
  const clustersRef = useRef<Cluster[]>(clusters)
  useEffect(() => { clustersRef.current = clusters }, [clusters])
  const uploadRef = useRef<HTMLInputElement>(null)

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

  const runClustering = useCallback((data: ImageData, k: number, prevClusters?: Cluster[]) => {
    if (workerRef.current) workerRef.current.terminate()

    setIsProcessing(true)
    setSelectedCluster(null)
    setPixelOverrides(new Map())

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

      let newClusters: Cluster[] = centroids.map((c, i) => ({
        id: i,
        originalColor: { r: c[0], g: c[1], b: c[2] },
        currentColor:  { r: c[0], g: c[1], b: c[2] },
        visible: true,
        pixelCount: pixelCounts[i],
      }))

      if (prevClusters && prevClusters.length > 0) {
        newClusters = preserveColors(prevClusters, newClusters)
      }

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

    // Copy the pixel buffer then transfer the copy — avoids a slow structured-clone of the full ImageData
    const pixelsBuf = data.data.buffer.slice(0)
    worker.postMessage(
      { pixels: new Uint8Array(pixelsBuf), width: data.width, height: data.height, k },
      [pixelsBuf],
    )
  }, [])

  const handleImage = (_img: HTMLImageElement, data: ImageData) => {
    setImageData(data)
    runClustering(data, clusterCount) // fresh image → no color preservation
    regenerateNoise(data, noiseSettings)
  }

  const handleUploadNew = () => uploadRef.current?.click()

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    e.target.value = ''
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      handleImage(img, ctx.getImageData(0, 0, canvas.width, canvas.height))
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const handleClusterCountChange = (n: number) => {
    setClusterCount(n)
    if (imageData) runClustering(imageData, n, clusters)
  }

  const handleReRun = () => {
    if (imageData) runClustering(imageData, clusterCount, clusters)
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

  const handleLassoFill = useCallback((overrides: Map<number, number>) => {
    setPixelOverrides(prev => {
      const next = new Map(prev)
      for (const [k, v] of overrides) next.set(k, v)
      return next
    })
  }, [])

  const handleClearPixelOverrides = () => setPixelOverrides(new Map())

  // Download — applies cluster colors + text overlay + noise, same as canvas render
  const handleDownload = (format: 'png' | 'jpeg') => {
    if (!imageData || !clusterMap || !clusters.length) return

    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!
    const out = new ImageData(imageData.width, imageData.height)
    const outView = new Uint32Array(out.data.buffer)
    const n = imageData.width * imageData.height

    // Build per-cluster packed ARGB (little-endian → RGBA bytes in canvas)
    const lut = new Uint32Array(clusters.length)
    const white32 = (255 << 24) | (255 << 16) | (255 << 8) | 255
    clusters.forEach((c, i) => {
      if (c.visible) {
        const { r, g, b } = c.currentColor
        lut[i] = (255 << 24) | (b << 16) | (g << 8) | r
      } else {
        lut[i] = format === 'jpeg' ? white32 : 0
      }
    })

    for (let i = 0; i < n; i++) {
      outView[i] = lut[clusterMap[i]]
    }

    for (const [idx, color] of pixelOverrides) outView[idx] = color

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
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleUploadFile}
      />
      <Toolbar
        hasImage={!!imageData}
        showOriginal={showOriginal}
        splitView={splitView}
        toolMode={toolMode}
        onToggleOriginal={() => setShowOriginal(v => !v)}
        onToggleSplitView={() => setSplitView(v => !v)}
        onUploadNew={handleUploadNew}
        onToggleToolMode={() => setToolMode(m => m === 'lasso' ? 'select' : 'lasso')}
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
          toolMode={toolMode}
          lassoColor={lassoColor}
          hasLassoOverrides={pixelOverrides.size > 0}
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
          onLassoColorChange={setLassoColor}
          onClearLassoOverrides={handleClearPixelOverrides}
        />
        <div className="canvas-area">
          {imageData && clusterMap && clusters.length > 0 ? (
            <>
              <div className="canvas-pane">
                <ImageCanvas
                  key={splitView ? 'left' : 'single'}
                  imageData={imageData}
                  clusterMap={clusterMap}
                  clusters={clusters}
                  selectedCluster={selectedCluster}
                  showOriginal={showOriginal}
                  noiseSettings={noiseSettings}
                  noiseMap={noiseMap}
                  textOverlay={textOverlay}
                  toolMode={toolMode}
                  lassoColor={lassoColor}
                  pixelOverrides={pixelOverrides}
                  onSelectCluster={setSelectedCluster}
                  onLassoFill={handleLassoFill}
                />
              </div>
              {splitView && (
                <div className="canvas-pane">
                  <ImageCanvas
                    key="right"
                    imageData={imageData}
                    clusterMap={clusterMap}
                    clusters={clusters}
                    selectedCluster={selectedCluster}
                    showOriginal={showOriginal}
                    noiseSettings={noiseSettings}
                    noiseMap={noiseMap}
                    textOverlay={textOverlay}
                    toolMode={toolMode}
                    lassoColor={lassoColor}
                    pixelOverrides={pixelOverrides}
                    onSelectCluster={setSelectedCluster}
                    onLassoFill={handleLassoFill}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="canvas-pane">
              <ImageUpload onImage={handleImage} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
