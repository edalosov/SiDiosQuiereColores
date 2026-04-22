import { useEffect, type FC } from 'react'
import type { ColorFormat, TextOverlay } from '../types'
import { loadGoogleFont, FONT_GROUPS } from '../utils/fonts'
import ColorPicker from './ColorPicker'

interface Props {
  settings: TextOverlay
  disabled: boolean
  colorFormat: ColorFormat
  onSettingsChange: (s: TextOverlay) => void
  onColorCommit: () => void
}

const TextPanel: FC<Props> = ({ settings, disabled, colorFormat, onSettingsChange, onColorCommit }) => {
  const merge = (patch: Partial<TextOverlay>): TextOverlay => ({ ...settings, ...patch })
  const set = (patch: Partial<TextOverlay>) => onSettingsChange(merge(patch))

  useEffect(() => {
    loadGoogleFont(settings.fontFamily)
  }, [settings.fontFamily])

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

          <div className="noise-row">
            <div className="noise-row-header">
              <p className="noise-row-label">Size</p>
              <span className="noise-value">{settings.fontSize}px</span>
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

          <div className="noise-row">
            <p className="noise-row-label">Color</p>
            <ColorPicker
              color={settings.color}
              format={colorFormat}
              onChange={color => set({ color })}
              onCommit={onColorCommit}
            />
          </div>

          <div className="noise-row">
            <div className="noise-row-header">
              <p className="noise-row-label">Left Margin</p>
              <span className="noise-value">{settings.marginX}px</span>
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

          <div className="noise-row">
            <div className="noise-row-header">
              <p className="noise-row-label">Bottom Margin</p>
              <span className="noise-value">{settings.marginY}px</span>
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

export default TextPanel
