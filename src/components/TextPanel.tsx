import { useEffect, type FC, type ChangeEvent } from 'react'
import type { ColorFormat, TextAnchor, TextOverlay } from '../types'
import { loadGoogleFont, FONT_GROUPS } from '../utils/fonts'
import ColorPicker from './ColorPicker'

interface Props {
  settings: TextOverlay
  disabled: boolean
  colorFormat: ColorFormat
  onSettingsChange: (s: TextOverlay) => void
  onColorCommit: () => void
}

const ANCHORS: { value: TextAnchor; label: string }[] = [
  { value: 'top-left',     label: 'Top Left' },
  { value: 'top-right',    label: 'Top Right' },
  { value: 'bottom-left',  label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
]

const TextPanel: FC<Props> = ({ settings, disabled, colorFormat, onSettingsChange, onColorCommit }) => {
  const merge = (patch: Partial<TextOverlay>): TextOverlay => ({ ...settings, ...patch })
  const set = (patch: Partial<TextOverlay>) => onSettingsChange(merge(patch))

  useEffect(() => {
    loadGoogleFont(settings.fontFamily)
  }, [settings.fontFamily])

  const isRight  = settings.anchor.includes('right')
  const isBottom = settings.anchor.includes('bottom')

  // Generic number field handler: commit value on blur/enter, allow free typing
  function numInput(
    value: number,
    min: number,
    max: number,
    key: keyof TextOverlay,
  ) {
    const clamp = (v: number) => Math.max(min, Math.min(max, v))
    return {
      type: 'number' as const,
      className: 'noise-value-input',
      value,
      min,
      max,
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        const v = +e.target.value
        if (e.target.value !== '' && !isNaN(v)) set({ [key]: v })
      },
      onBlur: (e: ChangeEvent<HTMLInputElement>) => {
        const v = +e.target.value
        set({ [key]: isNaN(v) || e.target.value === '' ? value : clamp(v) })
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          const v = +(e.target as HTMLInputElement).value
          set({ [key]: isNaN(v) ? value : clamp(v) });
          (e.target as HTMLInputElement).blur()
        }
      },
    }
  }

  return (
    <div className={`noise-panel ${disabled ? 'noise-disabled' : ''}`}>
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
          {/* Text content */}
          <div className="noise-row">
            <p className="noise-row-label">Text</p>
            <input
              className="text-overlay-input"
              type="text"
              value={settings.content}
              onChange={e => set({ content: e.target.value })}
              placeholder="Enter text or number…"
            />
          </div>

          {/* Anchor */}
          <div className="noise-row">
            <p className="noise-row-label">Position</p>
            <div className="anchor-grid">
              {ANCHORS.map(a => (
                <button
                  key={a.value}
                  className={`anchor-btn ${settings.anchor === a.value ? 'active' : ''}`}
                  onClick={() => set({ anchor: a.value })}
                  title={a.label}
                >
                  <AnchorIcon anchor={a.value} />
                  <span className="anchor-label">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font family */}
          <div className="noise-row">
            <p className="noise-row-label">Font</p>
            <select
              className="font-select"
              value={settings.fontFamily}
              onChange={e => set({ fontFamily: e.target.value })}
            >
              {FONT_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.fonts.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Font size */}
          <div className="noise-row">
            <div className="noise-row-header">
              <p className="noise-row-label">Size</p>
              <label className="noise-value-field">
                <input {...numInput(settings.fontSize, 8, 300, 'fontSize')} />
                <span>px</span>
              </label>
            </div>
            <input
              type="range"
              min={8}
              max={300}
              value={settings.fontSize}
              onChange={e => set({ fontSize: +e.target.value })}
              className="cluster-slider"
            />
            <div className="cluster-slider-labels">
              <span>8px</span><span>300px</span>
            </div>
          </div>

          {/* Color */}
          <div className="noise-row">
            <p className="noise-row-label">Color</p>
            <ColorPicker
              color={settings.color}
              format={colorFormat}
              onChange={color => set({ color })}
              onCommit={onColorCommit}
            />
          </div>

          {/* Horizontal margin */}
          <div className="noise-row">
            <div className="noise-row-header">
              <p className="noise-row-label">{isRight ? 'Right' : 'Left'} Margin</p>
              <label className="noise-value-field">
                <input {...numInput(settings.marginX, 0, 500, 'marginX')} />
                <span>px</span>
              </label>
            </div>
            <input
              type="range"
              min={0}
              max={500}
              value={settings.marginX}
              onChange={e => set({ marginX: +e.target.value })}
              className="cluster-slider"
            />
          </div>

          {/* Vertical margin */}
          <div className="noise-row">
            <div className="noise-row-header">
              <p className="noise-row-label">{isBottom ? 'Bottom' : 'Top'} Margin</p>
              <label className="noise-value-field">
                <input {...numInput(settings.marginY, 0, 500, 'marginY')} />
                <span>px</span>
              </label>
            </div>
            <input
              type="range"
              min={0}
              max={500}
              value={settings.marginY}
              onChange={e => set({ marginY: +e.target.value })}
              className="cluster-slider"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function AnchorIcon({ anchor }: { anchor: TextAnchor }) {
  const right  = anchor.includes('right')
  const bottom = anchor.includes('bottom')
  const cx = right  ? 13 : 5
  const cy = bottom ? 13 : 5
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <circle cx={cx} cy={cy} r="2.5" fill="currentColor" />
    </svg>
  )
}

export default TextPanel
