import type { FC } from 'react'
import type { NoiseSettings } from '../types'

interface Props {
  settings: NoiseSettings
  disabled: boolean
  onSettingsChange: (s: NoiseSettings) => void
  onRegenerate: (s: NoiseSettings) => void
}

const TYPE_LABELS: Record<NoiseSettings['type'], string> = {
  grain: 'Grain',
  colored: 'Color',
  'salt-pepper': 'S&P',
}

const TYPE_TIPS: Record<NoiseSettings['type'], string> = {
  grain: 'Monochrome film grain (gaussian)',
  colored: 'Independent per-channel noise',
  'salt-pepper': 'Random black & white pixels',
}

const NoisePanel: FC<Props> = ({ settings, disabled, onSettingsChange, onRegenerate }) => {
  // Always build the merged object first so every caller has the exact new value
  const merge = (patch: Partial<NoiseSettings>): NoiseSettings => ({ ...settings, ...patch })
  const set = (patch: Partial<NoiseSettings>) => onSettingsChange(merge(patch))

  return (
    <div className={`noise-panel ${disabled ? 'noise-disabled' : ''}`}>
      {/* Enable toggle */}
      <div className="noise-header">
        <button
          className={`noise-enable-btn ${settings.enabled ? 'active' : ''}`}
          onClick={() => set({ enabled: !settings.enabled })}
          disabled={disabled}
        >
          <div className={`noise-toggle-track ${settings.enabled ? 'on' : ''}`}>
            <div className="noise-toggle-thumb" />
          </div>
          <span>{settings.enabled ? 'Enabled' : 'Disabled'}</span>
        </button>
      </div>

      {settings.enabled && (
        <div className="noise-body">
          {/* Type */}
          <div className="noise-row">
            <p className="noise-row-label">Type</p>
            <div className="format-toggle">
              {(['grain', 'colored', 'salt-pepper'] as NoiseSettings['type'][]).map(t => (
                <button
                  key={t}
                  className={`format-btn ${settings.type === t ? 'active' : ''}`}
                  title={TYPE_TIPS[t]}
                  onClick={() => {
                    const next = merge({ type: t })
                    onSettingsChange(next)
                    onRegenerate(next)
                  }}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="noise-row">
            <div className="noise-row-header">
              <p className="noise-row-label">Amount</p>
              <span className="noise-value">{settings.amount}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.amount}
              onChange={e => set({ amount: +e.target.value })}
              className="cluster-slider"
            />
            <div className="cluster-slider-labels">
              <span>0%</span><span>100%</span>
            </div>
          </div>

          {/* Scale */}
          <div className="noise-row">
            <div className="noise-row-header">
              <p className="noise-row-label">Grain Size</p>
              <span className="noise-value">{scaleLabel(settings.scale)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={settings.scale}
              onChange={e => {
                const next = merge({ scale: +e.target.value })
                onSettingsChange(next)
                onRegenerate(next)
              }}
              className="cluster-slider"
            />
            <div className="cluster-slider-labels">
              <span>Fine</span><span>Coarse</span>
            </div>
          </div>

          {/* Regenerate */}
          <button className="btn-rerun" onClick={() => onRegenerate(settings)}>
            <DiceIcon />
            New Random Pattern
          </button>
        </div>
      )}
    </div>
  )
}

function scaleLabel(scale: number): string {
  if (scale <= 1) return 'Fine'
  if (scale <= 3) return 'Medium'
  if (scale <= 6) return 'Coarse'
  return 'Very Coarse'
}

function DiceIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default NoisePanel
