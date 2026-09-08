import { CanvasTexture, RepeatWrapping, type Texture } from 'three'
import type { DayLighting } from './timeOfDay'

/**
 * Ground and sky, generated the way the room's materials are: drawn once into a canvas and
 * cached. Nothing is downloaded.
 *
 * The lesson from the room applies unchanged out here — **a flat colour on a large plane is
 * what makes a scene look like blocks.** A lawn is thousands of blades at slightly different
 * angles catching light differently; gravel is thousands of stones. Neither is one green or
 * one grey, and no amount of good lighting rescues a surface with no variation in it.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(size: number) {
  const element = document.createElement('canvas')
  element.width = size
  element.height = size
  return { element, ctx: element.getContext('2d')! }
}

function tile(element: HTMLCanvasElement, repeat: number) {
  const texture = new CanvasTexture(element)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.anisotropy = 8
  return texture
}

let grassCache: Texture | null = null

/**
 * Lawn: a mottled base, then several thousand short strokes at scattered angles. The strokes
 * are what matter — they give the surface a direction that changes across it, which is the
 * thing your eye reads as grass rather than as green paint.
 */
export function createGrassTexture(): Texture {
  if (grassCache) return grassCache

  const size = 512
  const { element, ctx } = canvas(size)
  const random = mulberry32(7)

  ctx.fillStyle = '#4E5E38'
  ctx.fillRect(0, 0, size, size)

  // Broad patches, so the lawn is not evenly lit before a single blade is drawn.
  for (let i = 0; i < 90; i += 1) {
    const x = random() * size
    const y = random() * size
    const r = 30 + random() * 90
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    const light = random() > 0.5
    gradient.addColorStop(0, light ? 'rgba(122,142,84,0.30)' : 'rgba(48,60,34,0.30)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.lineCap = 'round'
  for (let i = 0; i < 9000; i += 1) {
    const x = random() * size
    const y = random() * size
    const angle = -Math.PI / 2 + (random() - 0.5) * 1.5
    const length = 3 + random() * 7
    const shade = random()
    ctx.strokeStyle =
      shade > 0.72
        ? `rgba(146,166,96,${0.4 + random() * 0.4})`
        : shade > 0.34
          ? `rgba(86,104,58,${0.4 + random() * 0.4})`
          : `rgba(40,52,30,${0.35 + random() * 0.4})`
    ctx.lineWidth = 0.8 + random() * 0.9
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
    ctx.stroke()
  }

  grassCache = tile(element, 26)
  return grassCache
}

let gravelCache: Texture | null = null

/** The path: packed gravel, drawn as overlapping stones rather than a grey fill. */
export function createGravelTexture(): Texture {
  if (gravelCache) return gravelCache

  const size = 512
  const { element, ctx } = canvas(size)
  const random = mulberry32(21)

  ctx.fillStyle = '#9C927F'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 2600; i += 1) {
    const x = random() * size
    const y = random() * size
    const r = 1.6 + random() * 5
    const shade = random()
    ctx.fillStyle =
      shade > 0.7
        ? `rgba(190,180,162,${0.5 + random() * 0.4})`
        : shade > 0.36
          ? `rgba(146,136,120,${0.5 + random() * 0.4})`
          : `rgba(96,88,76,${0.45 + random() * 0.4})`
    ctx.beginPath()
    // Slightly squashed and rotated, so no stone is a perfect circle.
    ctx.ellipse(x, y, r, r * (0.6 + random() * 0.5), random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  gravelCache = tile(element, 9)
  return gravelCache
}

const skyCache = new Map<string, Texture>()

/**
 * The sky, as a vertical gradient with the horizon light at the bottom. At night it also gets
 * stars — drawn into the same canvas rather than added as geometry, because a few hundred
 * points of light cost nothing as pixels and a great deal as objects.
 */
export function createSkyTexture(lighting: DayLighting): Texture {
  const key = `${lighting.phase}`
  const cached = skyCache.get(key)
  if (cached) return cached

  const w = 64
  const h = 512
  const element = document.createElement('canvas')
  element.width = w
  element.height = h
  const ctx = element.getContext('2d')!

  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, lighting.skyTop)
  gradient.addColorStop(0.62, lighting.skyTop)
  gradient.addColorStop(1, lighting.skyBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  if (lighting.phase === 'night') {
    const random = mulberry32(3)
    for (let i = 0; i < 420; i += 1) {
      // Denser overhead, thinning toward the horizon where the sky is still lit.
      const y = random() ** 1.6 * h * 0.78
      const x = random() * w
      const brightness = 0.35 + random() * 0.65
      const r = random() > 0.94 ? 1.5 : 0.7
      ctx.fillStyle = `rgba(255,250,235,${brightness})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const texture = new CanvasTexture(element)
  texture.wrapS = RepeatWrapping
  texture.repeat.set(6, 1)
  skyCache.set(key, texture)
  return texture
}
