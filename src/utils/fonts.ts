export const FONT_GROUPS: { label: string; fonts: string[] }[] = [
  {
    label: 'Sans-Serif',
    fonts: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Source Sans 3'],
  },
  {
    label: 'Serif',
    fonts: ['Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'EB Garamond', 'Libre Baskerville'],
  },
  {
    label: 'Monospace',
    fonts: ['JetBrains Mono', 'Source Code Pro', 'Fira Code', 'Space Mono', 'IBM Plex Mono'],
  },
  {
    label: 'Display',
    fonts: ['Bebas Neue', 'Oswald', 'Anton', 'Righteous', 'Pacifico', 'Lobster', 'Dancing Script'],
  },
]

const loadedFonts = new Set<string>()

export async function loadGoogleFont(family: string): Promise<void> {
  if (loadedFonts.has(family)) return
  const id = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`
  if (!document.getElementById(id)) {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}&display=swap`
    document.head.appendChild(link)
  }
  try {
    await document.fonts.load(`16px "${family}"`)
  } catch {
    // font may still work even if load() times out
  }
  loadedFonts.add(family)
}
