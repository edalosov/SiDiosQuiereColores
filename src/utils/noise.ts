import type { NoiseSettings } from '../types'

function gaussian(): number {
  const u = Math.random() || 1e-10
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random())
}

/**
 * Generates a Float32Array of size (width * height * 3) with per-pixel noise offsets.
 *
 * grain:       monochrome gaussian — same value in all 3 channels, values in [-1, 1]
 * colored:     independent per-channel gaussian, values in [-1, 1]
 * salt-pepper: uniform [0, 1] in all 3 channels (threshold applied during render)
 *
 * scale controls grain size: at scale=4, noise is generated at 1/4 resolution and upscaled.
 */
export function generateNoiseMap(
  width: number,
  height: number,
  type: NoiseSettings['type'],
  scale: number,
): Float32Array {
  const sc = Math.max(1, Math.round(scale))
  const sw = Math.ceil(width / sc)
  const sh = Math.ceil(height / sc)
  const count = sw * sh
  const base = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const b = i * 3
    if (type === 'grain') {
      const v = Math.max(-1, Math.min(1, gaussian() / 2.5))
      base[b] = base[b + 1] = base[b + 2] = v
    } else if (type === 'colored') {
      base[b]     = Math.max(-1, Math.min(1, gaussian() / 2.5))
      base[b + 1] = Math.max(-1, Math.min(1, gaussian() / 2.5))
      base[b + 2] = Math.max(-1, Math.min(1, gaussian() / 2.5))
    } else {
      // salt-pepper: uniform random — same value for all channels
      const v = Math.random()
      base[b] = base[b + 1] = base[b + 2] = v
    }
  }

  // No upscaling needed when scale === 1 and sizes match exactly
  if (sc === 1) return base

  const map = new Float32Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    const sy = Math.min(Math.floor(y / sc), sh - 1)
    for (let x = 0; x < width; x++) {
      const sx = Math.min(Math.floor(x / sc), sw - 1)
      const bi = (sy * sw + sx) * 3
      const mi = (y * width + x) * 3
      map[mi]     = base[bi]
      map[mi + 1] = base[bi + 1]
      map[mi + 2] = base[bi + 2]
    }
  }
  return map
}

/**
 * Applies noise in-place to an ImageData pixel buffer.
 * Skips fully transparent pixels (alpha === 0 → hidden clusters).
 * Should be called AFTER cluster colors are written and BEFORE putImageData.
 */
export function applyNoise(
  dst: Uint8ClampedArray,
  noiseMap: Float32Array,
  settings: NoiseSettings,
): void {
  const { type, amount } = settings
  const amtScale = amount / 100
  const n = dst.length / 4

  for (let i = 0; i < n; i++) {
    const pi = i * 4
    if (dst[pi + 3] === 0) continue // hidden / transparent pixel — skip

    const ni = i * 3

    if (type === 'salt-pepper') {
      // density: at amount=100, ~20% of pixels affected (10% salt + 10% pepper)
      const half = amtScale * 0.1
      const v = noiseMap[ni]
      if (v < half) {
        dst[pi] = 0; dst[pi + 1] = 0; dst[pi + 2] = 0
      } else if (v > 1 - half) {
        dst[pi] = 255; dst[pi + 1] = 255; dst[pi + 2] = 255
      }
    } else {
      const d = amtScale * 255
      dst[pi]     = Math.max(0, Math.min(255, dst[pi]     + Math.round(noiseMap[ni]     * d)))
      dst[pi + 1] = Math.max(0, Math.min(255, dst[pi + 1] + Math.round(noiseMap[ni + 1] * d)))
      dst[pi + 2] = Math.max(0, Math.min(255, dst[pi + 2] + Math.round(noiseMap[ni + 2] * d)))
    }
  }
}
