import type { RGBColor, HSBColor } from '../types'

export function rgbToHsb(r: number, g: number, b: number): HSBColor {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h = h * 60
    if (h < 0) h += 360
  }

  const s = max === 0 ? 0 : (delta / max) * 100
  const bv = max * 100

  return { h: Math.round(h), s: Math.round(s), b: Math.round(bv) }
}

export function hsbToRgb(h: number, s: number, b: number): RGBColor {
  const sn = s / 100, bn = b / 100
  const k = (n: number) => (n + h / 60) % 6
  const f = (n: number) => bn * (1 - sn * Math.max(0, Math.min(k(n), 4 - k(n), 1)))
  return {
    r: Math.round(f(5) * 255),
    g: Math.round(f(3) * 255),
    b: Math.round(f(1) * 255),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}

export function hexToRgb(hex: string): RGBColor {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  const n = parseInt(full, 16)
  if (isNaN(n)) return { r: 0, g: 0, b: 0 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function clampRgb(c: RGBColor): RGBColor {
  return {
    r: Math.max(0, Math.min(255, Math.round(c.r))),
    g: Math.max(0, Math.min(255, Math.round(c.g))),
    b: Math.max(0, Math.min(255, Math.round(c.b))),
  }
}
