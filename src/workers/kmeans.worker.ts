/// <reference lib="webworker" />
// Runs entirely in a Web Worker — no DOM access

type RGB = [number, number, number]

function distSq(a: RGB, b: RGB): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

function nearestIdx(pixel: RGB, centroids: RGB[]): number {
  let best = 0, bestD = Infinity
  for (let i = 0; i < centroids.length; i++) {
    const d = distSq(pixel, centroids[i])
    if (d < bestD) { bestD = d; best = i }
  }
  return best
}

function kmeanspp(samples: RGB[], k: number): RGB[] {
  const centroids: RGB[] = [samples[Math.floor(Math.random() * samples.length)]]
  while (centroids.length < k) {
    const dists = samples.map(s => {
      let min = Infinity
      for (const c of centroids) { const d = distSq(s, c); if (d < min) min = d }
      return min
    })
    const total = dists.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    let added = false
    for (let i = 0; i < samples.length; i++) {
      r -= dists[i]
      if (r <= 0) { centroids.push(samples[i]); added = true; break }
    }
    // Fallback only if the weighted draw didn't land (floating-point edge case)
    if (!added) centroids.push(samples[samples.length - 1])
  }
  return centroids
}

self.onmessage = (e: MessageEvent) => {
  const { pixels, width, height, k } = e.data as {
    pixels: Uint8ClampedArray
    width: number
    height: number
    k: number
  }

  const totalPixels = width * height
  const sampleRate = Math.max(1, Math.floor(totalPixels / 30000))

  const samples: RGB[] = []
  for (let i = 0; i < totalPixels; i += sampleRate) {
    const idx = i * 4
    samples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]])
  }

  let centroids = kmeanspp(samples, k)

  for (let iter = 0; iter < 40; iter++) {
    const sums: [number, number, number][] = Array.from({ length: k }, () => [0, 0, 0])
    const counts = new Array<number>(k).fill(0)

    for (const s of samples) {
      const idx = nearestIdx(s, centroids)
      sums[idx][0] += s[0]
      sums[idx][1] += s[1]
      sums[idx][2] += s[2]
      counts[idx]++
    }

    let changed = false
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue
      const nr = Math.round(sums[c][0] / counts[c])
      const ng = Math.round(sums[c][1] / counts[c])
      const nb = Math.round(sums[c][2] / counts[c])
      if (nr !== centroids[c][0] || ng !== centroids[c][1] || nb !== centroids[c][2]) {
        centroids[c] = [nr, ng, nb]
        changed = true
      }
    }
    if (!changed) break
  }

  // Assign every pixel to its nearest centroid
  const clusterMap = new Uint8Array(totalPixels)
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    clusterMap[i] = nearestIdx([pixels[idx], pixels[idx + 1], pixels[idx + 2]], centroids)
  }

  // Count pixels per cluster
  const pixelCounts = new Uint32Array(k)
  for (let i = 0; i < totalPixels; i++) pixelCounts[clusterMap[i]]++

  // Sort clusters largest → smallest by pixel count
  const order = Array.from({ length: k }, (_, i) => i)
    .sort((a, b) => pixelCounts[b] - pixelCounts[a])

  // Build old-index → new-index remapping
  const remap = new Uint8Array(k)
  for (let ni = 0; ni < k; ni++) remap[order[ni]] = ni

  // Remap clusterMap in-place
  for (let i = 0; i < totalPixels; i++) clusterMap[i] = remap[clusterMap[i]]

  // Reorder centroids and pixelCounts to match sorted order
  const sortedCentroids = order.map(oi => centroids[oi])
  const sortedPixelCounts = new Uint32Array(k)
  for (let ni = 0; ni < k; ni++) sortedPixelCounts[ni] = pixelCounts[order[ni]]

  self.postMessage(
    { clusterMap, centroids: sortedCentroids, pixelCounts: sortedPixelCounts },
    [clusterMap.buffer, sortedPixelCounts.buffer],
  )
}
