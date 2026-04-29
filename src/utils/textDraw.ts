import type { TextOverlay } from '../types'

export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  t: TextOverlay,
  width: number,
  height: number,
) {
  const { r, g, b } = t.color
  ctx.save()
  ctx.font = `${t.fontSize}px "${t.fontFamily}"`
  ctx.fillStyle = `rgb(${r},${g},${b})`
  ctx.textAlign    = t.anchor.includes('right')  ? 'right'  : 'left'
  ctx.textBaseline = t.anchor.includes('bottom') ? 'bottom' : 'top'
  const x = t.anchor.includes('right')  ? width  - t.marginX : t.marginX
  const y = t.anchor.includes('bottom') ? height - t.marginY : t.marginY
  ctx.fillText(t.content, x, y)
  ctx.restore()
}
