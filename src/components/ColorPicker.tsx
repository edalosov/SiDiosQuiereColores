import { useEffect, useRef, useState, type FC } from 'react'
import type { ColorFormat, RGBColor } from '../types'
import { rgbToHsb, hsbToRgb, rgbToHex, hexToRgb, clampRgb } from '../utils/colorConversion'

interface Props {
  color: RGBColor
  format: ColorFormat
  onChange: (color: RGBColor) => void
  onCommit: () => void
}

const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

const ColorPicker: FC<Props> = ({ color, format, onChange, onCommit }) => {
  const pickerRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'picker' | 'hue' | null>(null)
  const [hexInput, setHexInput] = useState(rgbToHex(color.r, color.g, color.b))

  const hsb = rgbToHsb(color.r, color.g, color.b)

  // Keep hex input in sync unless user is typing
  const [hexFocused, setHexFocused] = useState(false)
  useEffect(() => {
    if (!hexFocused) setHexInput(rgbToHex(color.r, color.g, color.b))
  }, [color, hexFocused])

  const updateFromPicker = (clientX: number, clientY: number) => {
    const rect = pickerRef.current!.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 100
    const b = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)) * 100
    onChange(clampRgb(hsbToRgb(hsb.h, s, b)))
  }

  const updateFromHue = (clientX: number) => {
    const rect = hueRef.current!.getBoundingClientRect()
    const h = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 360
    onChange(clampRgb(hsbToRgb(h, hsb.s, hsb.b)))
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (dragging === 'picker') updateFromPicker(e.clientX, e.clientY)
      if (dragging === 'hue') updateFromHue(e.clientX)
    }
    const onUp = () => { setDragging(null); onCommit() }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, hsb])

  const hueColor = `hsl(${hsb.h}, 100%, 50%)`

  return (
    <div className="color-picker">
      {/* 2D saturation/brightness square */}
      <div
        ref={pickerRef}
        className="picker-square"
        style={{
          background: `
            linear-gradient(to bottom, transparent, #000),
            linear-gradient(to right, #fff, ${hueColor})
          `,
        }}
        onMouseDown={e => {
          setDragging('picker')
          updateFromPicker(e.clientX, e.clientY)
        }}
      >
        <div
          className="picker-cursor"
          style={{
            left: `${hsb.s}%`,
            top: `${100 - hsb.b}%`,
            background: `rgb(${color.r},${color.g},${color.b})`,
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className="hue-slider"
        onMouseDown={e => {
          setDragging('hue')
          updateFromHue(e.clientX)
        }}
      >
        <div className="hue-cursor" style={{ left: `${(hsb.h / 360) * 100}%` }} />
      </div>

      {/* Color preview + eyedropper */}
      <div className="color-preview-row">
        <div
          className="color-preview-strip"
          style={{ background: `rgb(${color.r},${color.g},${color.b})` }}
        />
        {hasEyeDropper && (
          <button
            className="eyedropper-btn"
            title="Pick color from screen"
            onClick={async () => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const dropper = new (window as any).EyeDropper()
                const result = await dropper.open()
                const rgb = clampRgb(hexToRgb(result.sRGBHex))
                onChange(rgb)
                onCommit()
              } catch {
                // user cancelled — do nothing
              }
            }}
          >
            <EyeDropperIcon />
          </button>
        )}
      </div>

      {/* Numeric inputs */}
      {format === 'HSB' && (
        <div className="color-inputs">
          <label className="color-input-group">
            <span>H</span>
            <input
              type="number" min={0} max={360}
              value={hsb.h}
              onChange={e => onChange(clampRgb(hsbToRgb(+e.target.value, hsb.s, hsb.b)))}
              onBlur={onCommit}
            />
          </label>
          <label className="color-input-group">
            <span>S</span>
            <input
              type="number" min={0} max={100}
              value={hsb.s}
              onChange={e => onChange(clampRgb(hsbToRgb(hsb.h, +e.target.value, hsb.b)))}
              onBlur={onCommit}
            />
          </label>
          <label className="color-input-group">
            <span>B</span>
            <input
              type="number" min={0} max={100}
              value={hsb.b}
              onChange={e => onChange(clampRgb(hsbToRgb(hsb.h, hsb.s, +e.target.value)))}
              onBlur={onCommit}
            />
          </label>
        </div>
      )}

      {format === 'RGB' && (
        <div className="color-inputs">
          <label className="color-input-group">
            <span>R</span>
            <input
              type="number" min={0} max={255}
              value={color.r}
              onChange={e => onChange(clampRgb({ ...color, r: +e.target.value }))}
              onBlur={onCommit}
            />
          </label>
          <label className="color-input-group">
            <span>G</span>
            <input
              type="number" min={0} max={255}
              value={color.g}
              onChange={e => onChange(clampRgb({ ...color, g: +e.target.value }))}
              onBlur={onCommit}
            />
          </label>
          <label className="color-input-group">
            <span>B</span>
            <input
              type="number" min={0} max={255}
              value={color.b}
              onChange={e => onChange(clampRgb({ ...color, b: +e.target.value }))}
              onBlur={onCommit}
            />
          </label>
        </div>
      )}

      {format === 'HEX' && (
        <div className="color-inputs hex-input">
          <label className="color-input-group hex">
            <span>#</span>
            <input
              type="text"
              value={hexInput.replace('#', '')}
              maxLength={7}
              onFocus={() => setHexFocused(true)}
              onBlur={() => {
                setHexFocused(false)
                const clean = hexInput.replace('#', '')
                const parsed = hexToRgb('#' + clean)
                onChange(clampRgb(parsed))
                onCommit()
              }}
              onChange={e => {
                const clean = e.target.value.replace('#', '')
                setHexInput(clean)
                if (/^[0-9a-fA-F]{6}$/.test(clean)) {
                  onChange(clampRgb(hexToRgb('#' + clean)))
                }
              }}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function EyeDropperIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8Z" />
    </svg>
  )
}

export default ColorPicker
