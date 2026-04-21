import type { FC } from 'react'
import type { Cluster, ColorFormat } from '../types'
import { rgbToHsb, rgbToHex } from '../utils/colorConversion'

interface Props {
  cluster: Cluster
  selected: boolean
  format: ColorFormat
  totalPixels: number
  onSelect: () => void
  onToggleVisibility: () => void
}

const ClusterSwatch: FC<Props> = ({
  cluster,
  selected,
  format,
  totalPixels,
  onSelect,
  onToggleVisibility,
}) => {
  const { r, g, b } = cluster.currentColor
  const colorStr = `rgb(${r},${g},${b})`
  const pct = totalPixels > 0 ? ((cluster.pixelCount / totalPixels) * 100).toFixed(1) : '0.0'

  let label = ''
  if (format === 'HEX') {
    label = rgbToHex(r, g, b).toUpperCase()
  } else if (format === 'RGB') {
    label = `${r}, ${g}, ${b}`
  } else {
    const hsb = rgbToHsb(r, g, b)
    label = `${hsb.h}° ${hsb.s}% ${hsb.b}%`
  }

  return (
    <div
      className={`cluster-swatch ${selected ? 'selected' : ''} ${!cluster.visible ? 'hidden' : ''}`}
      onClick={onSelect}
    >
      <div
        className="swatch-color"
        style={{ background: colorStr }}
      />
      <div className="swatch-info">
        <span className="swatch-label">{label}</span>
        <span className="swatch-pct">{pct}%</span>
      </div>
      <button
        className="swatch-eye"
        onClick={e => { e.stopPropagation(); onToggleVisibility() }}
        title={cluster.visible ? 'Hide cluster' : 'Show cluster'}
      >
        {cluster.visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default ClusterSwatch
