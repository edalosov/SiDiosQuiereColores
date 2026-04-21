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
