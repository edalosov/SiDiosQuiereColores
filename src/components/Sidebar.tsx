import type { FC } from 'react'
import type { Cluster, ColorFormat, NoiseSettings, RGBColor, TextOverlay } from '../types'
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
}) => {
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
        <button
          className="btn-rerun"
          onClick={onReRun}
          disabled={isProcessing}
        >
          <RefreshIcon />
          {isProcessing ? 'Processing…' : 'Re-run Clustering'}
        </button>
      </section>

      <div className="sidebar-divider" />

      {/* Cluster list */}
      <section className="sidebar-section">
        <p className="sidebar-label">
          {clusters.length > 0 ? `${clusters.length} Clusters` : 'No image loaded'}
        </p>
        {isProcessing && (
          <div className="processing-state">
            <Spinner />
            <span>Running k-means…</span>
          </div>
        )}
        <div className="cluster-list">
          {clusters.map(cluster => (
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

      <div className="sidebar-divider" />

      {/* Text overlay */}
      <section className="sidebar-section">
        <p className="sidebar-label">Text Overlay</p>
        <TextPanel
          settings={textOverlay}
          disabled={clusters.length === 0}
          colorFormat={colorFormat}
          onSettingsChange={onTextOverlayChange}
          onColorCommit={onColorCommit}
        />
      </section>
    </aside>
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

function Spinner() {
  return <div className="spinner" />
}

export default Sidebar
