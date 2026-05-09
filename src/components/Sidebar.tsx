import { useState, type FC } from 'react'
import type { Cluster, ColorFormat, NoiseSettings, RGBColor, TextOverlay, ToolMode } from '../types'
import ClusterSwatch from './ClusterSwatch'
import ColorPicker from './ColorPicker'
import NoisePanel from './NoisePanel'
import TextPanel from './TextPanel'

interface Props {
  clusters: Cluster[]
  selectedCluster: number | null
  colorFormat: ColorFormat
  clusterCount: number
  isProcessing: boolean
  totalPixels: number
  noiseSettings: NoiseSettings
  textOverlay: TextOverlay
  toolMode: ToolMode
  lassoColor: RGBColor
  hasLassoOverrides: boolean
  onSelectCluster: (id: number | null) => void
  onToggleVisibility: (id: number) => void
  onColorChange: (id: number, color: RGBColor) => void
  onColorCommit: () => void
  onColorFormatChange: (f: ColorFormat) => void
  onClusterCountChange: (n: number) => void
  onReRun: () => void
  onNoiseSettingsChange: (s: NoiseSettings) => void
  onNoiseRegenerate: (s: NoiseSettings) => void
  onTextOverlayChange: (s: TextOverlay) => void
  onLassoColorChange: (c: RGBColor) => void
  onClearLassoOverrides: () => void
}

const Sidebar: FC<Props> = ({
  clusters,
  selectedCluster,
  colorFormat,
  clusterCount,
  isProcessing,
  totalPixels,
  noiseSettings,
  textOverlay,
  toolMode,
  lassoColor,
  hasLassoOverrides,
  onSelectCluster,
  onToggleVisibility,
  onColorChange,
  onColorCommit,
  onColorFormatChange,
  onClusterCountChange,
  onReRun,
  onNoiseSettingsChange,
  onNoiseRegenerate,
  onTextOverlayChange,
  onLassoColorChange,
  onClearLassoOverrides,
}) => {
  const [sortBy, setSortBy] = useState<'percent' | 'brightness'>('percent')

  const uniqueColorCount = new Set(
    clusters.map(c => `${c.currentColor.r},${c.currentColor.g},${c.currentColor.b}`)
  ).size
  const canAutoCluster = clusters.length > 0 && uniqueColorCount < clusters.length

  const sortedClusters = [...clusters].sort((a, b) => {
    if (sortBy === 'percent') return b.pixelCount - a.pixelCount
    const lum = (c: typeof a) => 0.299 * c.currentColor.r + 0.587 * c.currentColor.g + 0.114 * c.currentColor.b
    return lum(a) - lum(b) // dark → light
  })

  const selected = selectedCluster !== null ? clusters[selectedCluster] : null

  return (
    <aside className="sidebar">
      {/* Color format toggle */}
      <section className="sidebar-section">
        <p className="sidebar-label">Color Format</p>
        <div className="format-toggle">
          {(['HSB', 'HEX', 'RGB'] as ColorFormat[]).map(f => (
            <button
              key={f}
              className={`format-btn ${colorFormat === f ? 'active' : ''}`}
              onClick={() => onColorFormatChange(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      <div className="sidebar-divider" />

      {/* Cluster count */}
      <section className="sidebar-section">
        <div className="cluster-count-header">
          <p className="sidebar-label">Clusters</p>
          <span className="cluster-count-value">{clusterCount}</span>
        </div>
        <input
          type="range"
          min={2}
          max={9}
          value={clusterCount}
          onChange={e => onClusterCountChange(+e.target.value)}
          className="cluster-slider"
          disabled={isProcessing}
        />
        <div className="cluster-slider-labels">
          <span>2</span><span>9</span>
        </div>
        <div className="cluster-run-btns">
          <button
            className="btn-rerun"
            onClick={onReRun}
            disabled={isProcessing}
            title="Re-run k-means with the same cluster count"
          >
            <RefreshIcon />
            {isProcessing ? 'Processing…' : 'Re-run'}
          </button>
          <button
            className="btn-rerun btn-autocluster"
            onClick={() => onClusterCountChange(uniqueColorCount)}
            disabled={isProcessing || !canAutoCluster}
            title={canAutoCluster
              ? `Re-cluster using ${uniqueColorCount} unique colors`
              : 'All clusters already have unique colors'}
          >
            <AutoIcon />
            {canAutoCluster ? `Auto (${uniqueColorCount})` : 'Auto'}
          </button>
        </div>
      </section>

      <div className="sidebar-divider" />

      {/* Cluster list */}
      <section className="sidebar-section">
        <div className="cluster-list-header">
          <p className="sidebar-label">
            {clusters.length > 0 ? `${clusters.length} Clusters` : 'No image loaded'}
          </p>
          {clusters.length > 0 && (
            <div className="cluster-sort-toggle">
              <button
                className={`cluster-sort-btn ${sortBy === 'percent' ? 'active' : ''}`}
                onClick={() => setSortBy('percent')}
                title="Sort by coverage"
              >
                %
              </button>
              <button
                className={`cluster-sort-btn ${sortBy === 'brightness' ? 'active' : ''}`}
                onClick={() => setSortBy('brightness')}
                title="Sort by brightness (dark → light)"
              >
                <BrightnessIcon />
              </button>
            </div>
          )}
        </div>
        {isProcessing && (
          <div className="processing-state">
            <Spinner />
            <span>Running k-means…</span>
          </div>
        )}
        <div className="cluster-list">
          {sortedClusters.map(cluster => (
            <ClusterSwatch
              key={cluster.id}
              cluster={cluster}
              selected={selectedCluster === cluster.id}
              format={colorFormat}
              totalPixels={totalPixels}
              onSelect={() => onSelectCluster(selectedCluster === cluster.id ? null : cluster.id)}
              onToggleVisibility={() => onToggleVisibility(cluster.id)}
            />
          ))}
        </div>
      </section>

      {/* Color picker for selected cluster */}
      {selected && (
        <>
          <div className="sidebar-divider" />
          <section className="sidebar-section">
            <p className="sidebar-label">Edit Cluster {selected.id + 1}</p>
            <ColorPicker
              color={selected.currentColor}
              format={colorFormat}
              onChange={color => onColorChange(selected.id, color)}
              onCommit={onColorCommit}
            />
            <button
              className="btn-reset"
              onClick={() => {
                onColorChange(selected.id, selected.originalColor)
                onColorCommit()
              }}
            >
              Reset to original
            </button>
          </section>
        </>
      )}

      {/* Lasso tool color */}
      {toolMode === 'lasso' && (
        <>
          <div className="sidebar-divider" />
          <section className="sidebar-section">
            <p className="sidebar-label">Lasso Fill Color</p>
            <div className="lasso-section">
              <ColorPicker
                color={lassoColor}
                format={colorFormat}
                onChange={onLassoColorChange}
                onCommit={() => {}}
              />
              {hasLassoOverrides && (
                <button className="btn-clear-lasso" onClick={onClearLassoOverrides}>
                  Clear lasso edits
                </button>
              )}
            </div>
          </section>
        </>
      )}

      <div className="sidebar-divider" />

      {/* Text overlay */}
      <section className="sidebar-section">
        <p className="sidebar-label">Text Overlay</p>
        <TextPanel
          settings={textOverlay}
          disabled={clusters.length === 0}
          clusters={clusters}
          onSettingsChange={onTextOverlayChange}
        />
      </section>

      <div className="sidebar-divider" />

      {/* Noise & texture */}
      <section className="sidebar-section">
        <p className="sidebar-label">Noise & Texture</p>
        <NoisePanel
          settings={noiseSettings}
          disabled={clusters.length === 0}
          onSettingsChange={onNoiseSettingsChange}
          onRegenerate={onNoiseRegenerate}
        />
      </section>
    </aside>
  )
}

function BrightnessIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function AutoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </svg>
  )
}

function Spinner() {
  return <div className="spinner" />
}

export default Sidebar
