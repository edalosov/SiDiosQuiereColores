export interface RGBColor {
  r: number
  g: number
  b: number
}

export interface HSBColor {
  h: number // 0–360
  s: number // 0–100
  b: number // 0–100
}

export type ColorFormat = 'HSB' | 'HEX' | 'RGB'

export interface Cluster {
  id: number
  originalColor: RGBColor
  currentColor: RGBColor
  visible: boolean
  pixelCount: number
}

export type ClusterSnapshot = {
  id: number
  currentColor: RGBColor
  visible: boolean
}[]

export interface NoiseSettings {
  enabled: boolean
  type: 'grain' | 'colored' | 'salt-pepper'
  amount: number   // 0–100
  scale: number    // 1–8  (fine → coarse grain size)
}

export interface TextOverlay {
  enabled: boolean
  content: string
  fontFamily: string
  fontSize: number   // px, relative to source image
  color: RGBColor
  marginX: number    // px from left edge
  marginY: number    // px from bottom edge
}
