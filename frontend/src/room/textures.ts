import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'

// Everything in the room is generated here. No image files, no downloads — the whole
// material library is arithmetic, so the scene weighs nothing and can never look like a
// mismatched pile of sourced assets.

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

// Value noise on a wrapping lattice, so every texture tiles seamlessly.
function makeNoise2D(seed: number, gridSize: number) {
  const rand = mulberry32(seed)
  const lattice = new Float32Array(gridSize * gridSize)
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = rand()

  return (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi

    const wrap = (v: number, m: number) => ((v % m) + m) % m
    const x0 = wrap(xi, gridSize)
    const y0 = wrap(yi, gridSize)
    const x1 = wrap(xi + 1, gridSize)
    const y1 = wrap(yi + 1, gridSize)

    const v00 = lattice[y0 * gridSize + x0]
    const v10 = lattice[y0 * gridSize + x1]
    const v01 = lattice[y1 * gridSize + x0]
    const v11 = lattice[y1 * gridSize + x1]

    const sx = smoothstep(xf)
    const sy = smoothstep(yf)
    const top = v00 + (v10 - v00) * sx
    const bottom = v01 + (v11 - v01) * sx
    return top + (bottom - top) * sy
  }
}

function makeFbm(seed: number, gridSize = 64) {
  const noise = makeNoise2D(seed, gridSize)
  return (x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5) => {
    let amplitude = 1
    let frequency = 1
    let sum = 0
    let norm = 0
    for (let o = 0; o < octaves; o += 1) {
      sum += noise(x * frequency, y * frequency) * amplitude
      norm += amplitude
      amplitude *= gain
      frequency *= lacunarity
    }
    return sum / norm
  }
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function finish(canvas: HTMLCanvasElement, repeat: number, srgb: boolean): Texture {
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.anisotropy = 8
  if (srgb) texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createCanvas(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas
}

// Height field -> tangent-space normal map, via Sobel. This is what makes the wood catch
// the light as the camera moves; without it, every surface reads as flat paint.
function heightToNormalTexture(height: Float32Array, size: number, strength: number, repeat: number) {
  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)

  const at = (x: number, y: number) => {
    const xi = ((x % size) + size) % size
    const yi = ((y % size) + size) % size
    return height[yi * size + xi]
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const tl = at(x - 1, y - 1)
      const t = at(x, y - 1)
      const tr = at(x + 1, y - 1)
      const l = at(x - 1, y)
      const r = at(x + 1, y)
      const bl = at(x - 1, y + 1)
      const b = at(x, y + 1)
      const br = at(x + 1, y + 1)

      const dx = tl + 2 * l + bl - (tr + 2 * r + br)
      const dy = tl + 2 * t + tr - (bl + 2 * b + br)
      const dz = 1 / Math.max(0.001, strength)

      const len = Math.hypot(dx, dy, dz) || 1
      const i = (y * size + x) * 4
      image.data[i] = ((dx / len) * 0.5 + 0.5) * 255
      image.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      image.data[i + 2] = ((dz / len) * 0.5 + 0.5) * 255
      image.data[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return finish(canvas, repeat, false)
}

function grayscaleTexture(values: Float32Array, size: number, repeat: number) {
  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  for (let i = 0; i < values.length; i += 1) {
    const v = Math.max(0, Math.min(1, values[i])) * 255
    image.data[i * 4] = v
    image.data[i * 4 + 1] = v
    image.data[i * 4 + 2] = v
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return finish(canvas, repeat, false)
}

export interface MaterialMaps {
  map: Texture
  normalMap: Texture
  roughnessMap: Texture
}

// Generating these is genuinely expensive — hundreds of thousands of fbm samples per map, all
// on the main thread. Identical requests must return the identical texture, or a shelf of
// twelve books would freeze the page building twelve copies of the same paper.
const cache = new Map<string, MaterialMaps>()

function cached(key: string, build: () => MaterialMaps): MaterialMaps {
  const hit = cache.get(key)
  if (hit) return hit
  const built = build()
  cache.set(key, built)
  return built
}

/**
 * Wood with growth rings, fine grain streaks and the occasional knot. `plankAxis` runs the
 * grain along the board's length; `warm`/`dark` set the species.
 */
export function createWoodMaps(options: {
  seed?: number
  light?: string
  dark?: string
  size?: number
  repeat?: number
  ringFrequency?: number
  knots?: number
}): MaterialMaps {
  return cached(`wood:${JSON.stringify(options)}`, () => buildWoodMaps(options))
}

function buildWoodMaps(options: {
  seed?: number
  light?: string
  dark?: string
  size?: number
  repeat?: number
  ringFrequency?: number
  knots?: number
}): MaterialMaps {
  const {
    seed = 7,
    light = '#C9A77C',
    dark = '#7A5233',
    size = 512,
    repeat = 1,
    ringFrequency = 9,
    knots = 2,
  } = options

  const fbm = makeFbm(seed)
  const fine = makeFbm(seed + 101, 128)
  const lightRgb = hexToRgb(light)
  const darkRgb = hexToRgb(dark)

  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  const height = new Float32Array(size * size)
  const rough = new Float32Array(size * size)

  const knotCentres = Array.from({ length: knots }, (_, i) => {
    const rand = mulberry32(seed * 31 + i * 17)
    return { x: rand(), y: rand(), r: 0.03 + rand() * 0.04 }
  })

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size

      // Grain runs along the board's length (u). Distortion is kept well under one ring
      // spacing — the earlier version wandered by more than a full ring, which is what turned
      // the floor into sand dunes rather than timber.
      const wobble = fbm(u * 2.2, v * 5, 3) - 0.5
      let ringCoord = v * ringFrequency + wobble * 0.55

      // Knots drag the rings into a tight whorl around them.
      for (const knot of knotCentres) {
        const dx = u - knot.x
        const dy = v - knot.y
        const d = Math.hypot(dx, dy)
        if (d < knot.r * 5) {
          ringCoord += (knot.r * 5 - d) * 5
        }
      }

      // Sharpened rings: real timber has narrow dark latewood bands, not a smooth sine.
      const ring = Math.pow(Math.abs(Math.sin(ringCoord * Math.PI)), 2.4)
      // Strongly anisotropic noise = fine fibres running the length of the board.
      const fibre = fine(u * 4, v * 150, 2) - 0.5
      const pore = fine(u * 26, v * 90, 2) - 0.5

      let t = ring * 0.68 + fibre * 0.3 + pore * 0.16 + 0.12
      t = Math.max(0, Math.min(1, t))

      const shade = 0.94 + fbm(u * 1.1, v * 1.1, 3) * 0.12

      const i = (y * size + x) * 4
      image.data[i] = Math.min(255, mix(lightRgb.r, darkRgb.r, t) * shade)
      image.data[i + 1] = Math.min(255, mix(lightRgb.g, darkRgb.g, t) * shade)
      image.data[i + 2] = Math.min(255, mix(lightRgb.b, darkRgb.b, t) * shade)
      image.data[i + 3] = 255

      // Darker late-growth rings sit slightly proud and read as rougher.
      height[y * size + x] = t * 0.6 + fibre * 0.4 + 0.2
      rough[y * size + x] = 0.5 + t * 0.22
    }
  }

  ctx.putImageData(image, 0, 0)

  return {
    map: finish(canvas, repeat, true),
    normalMap: heightToNormalTexture(height, size, 2.1, repeat),
    roughnessMap: grayscaleTexture(rough, size, repeat),
  }
}

/**
 * A laid floor rather than a sheet of wood: discrete boards, staggered end joints, a dark
 * seam between each, and its own tone and grain phase per board. This is the difference
 * between a floor someone laid and a continuous wooden blur.
 */
export function createPlankMaps(options: {
  seed?: number
  light?: string
  dark?: string
  size?: number
  repeat?: number
  boards?: number
} = {}): MaterialMaps {
  return cached(`plank:${JSON.stringify(options)}`, () => buildPlankMaps(options))
}

function buildPlankMaps(options: {
  seed?: number
  light?: string
  dark?: string
  size?: number
  repeat?: number
  boards?: number
}): MaterialMaps {
  const {
    seed = 3,
    light = '#C9A276',
    dark = '#9A6F43',
    size = 1024,
    repeat = 1,
    boards = 7,
  } = options

  const fine = makeFbm(seed + 41, 128)
  const drift = makeFbm(seed + 7)
  const lightRgb = hexToRgb(light)
  const darkRgb = hexToRgb(dark)

  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  const height = new Float32Array(size * size)
  const rough = new Float32Array(size * size)

  const boardRand = mulberry32(seed * 7919)
  const boardTone: number[] = []
  const boardPhase: number[] = []
  const boardStagger: number[] = []
  for (let i = 0; i < boards; i += 1) {
    boardTone.push(boardRand())
    boardPhase.push(boardRand() * 10)
    boardStagger.push(boardRand())
  }

  const seamWidth = 0.0016

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size

      const boardF = v * boards
      const boardIndex = Math.floor(boardF) % boards
      const withinBoard = boardF - Math.floor(boardF)

      // End joints are offset per row so the floor never shows a continuous cross seam.
      const uShift = u + boardStagger[boardIndex]
      const segment = Math.floor(uShift * 2.5)
      const withinSegment = uShift * 2.5 - segment

      const tone = boardTone[boardIndex]
      const phase = boardPhase[boardIndex] + segment * 0.7

      // Grain runs the length of the board, tight and directional.
      const ringCoord = withinBoard * 5.5 + phase + (fine(u * 3, v * 60, 2) - 0.5) * 0.5
      const ring = Math.pow(Math.abs(Math.sin(ringCoord * Math.PI)), 2.6)
      const fibre = fine(u * 6, v * 220, 2) - 0.5

      let t = ring * 0.55 + fibre * 0.34 + 0.16
      t = Math.max(0, Math.min(1, t))

      // Per-board colour: some boards are simply darker than their neighbours.
      const boardShade = 0.9 + tone * 0.2 + (drift(u * 1.2, v * 1.2, 3) - 0.5) * 0.08

      const nearLongSeam = withinBoard < seamWidth * boards || withinBoard > 1 - seamWidth * boards
      const nearEndSeam = withinSegment < seamWidth * 2.5 || withinSegment > 1 - seamWidth * 2.5
      const seam = nearLongSeam || nearEndSeam

      let r = mix(lightRgb.r, darkRgb.r, t) * boardShade
      let g = mix(lightRgb.g, darkRgb.g, t) * boardShade
      let b = mix(lightRgb.b, darkRgb.b, t) * boardShade

      if (seam) {
        r *= 0.42
        g *= 0.4
        b *= 0.38
      }

      const i = (y * size + x) * 4
      image.data[i] = Math.min(255, r)
      image.data[i + 1] = Math.min(255, g)
      image.data[i + 2] = Math.min(255, b)
      image.data[i + 3] = 255

      // Seams sit low so light catches the board edges; boards are gently domed.
      const dome = Math.sin(withinBoard * Math.PI) * 0.18
      height[y * size + x] = seam ? 0.05 : 0.45 + dome + fibre * 0.25 + ring * 0.12
      // Waxed boards, slightly duller in the seams and along open grain.
      rough[y * size + x] = seam ? 0.9 : 0.42 + t * 0.2
    }
  }

  ctx.putImageData(image, 0, 0)

  return {
    map: finish(canvas, repeat, true),
    normalMap: heightToNormalTexture(height, size, 1.5, repeat),
    roughnessMap: grayscaleTexture(rough, size, repeat),
  }
}

/**
 * Painted joinery — window frames, skirting. Reads as cared-for rather than weathered: the
 * grain barely shows through the paint, which is exactly what separates "cosy vintage" from
 * "derelict".
 */
export function createPaintedMaps(options: {
  seed?: number
  color?: string
  size?: number
  repeat?: number
} = {}): MaterialMaps {
  return cached(`painted:${JSON.stringify(options)}`, () => buildPaintedMaps(options))
}

function buildPaintedMaps(options: {
  seed?: number
  color?: string
  size?: number
  repeat?: number
}): MaterialMaps {
  const { seed = 17, color = '#F2E8D8', size = 256, repeat = 1 } = options

  const brush = makeFbm(seed, 128)
  const drift = makeFbm(seed + 3)
  const base = hexToRgb(color)

  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  const height = new Float32Array(size * size)
  const rough = new Float32Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size

      // Faint brush direction and the ghost of grain under the paint.
      const stroke = brush(u * 3, v * 90, 2) - 0.5
      const broad = drift(u * 2, v * 2, 3) - 0.5
      const shade = 1 + stroke * 0.035 + broad * 0.045

      const i = (y * size + x) * 4
      image.data[i] = Math.max(0, Math.min(255, base.r * shade))
      image.data[i + 1] = Math.max(0, Math.min(255, base.g * shade))
      image.data[i + 2] = Math.max(0, Math.min(255, base.b * shade))
      image.data[i + 3] = 255

      height[y * size + x] = 0.5 + stroke * 0.35
      rough[y * size + x] = 0.52 + stroke * 0.06
    }
  }

  ctx.putImageData(image, 0, 0)

  return {
    map: finish(canvas, repeat, true),
    normalMap: heightToNormalTexture(height, size, 0.35, repeat),
    roughnessMap: grayscaleTexture(rough, size, repeat),
  }
}

/**
 * A patterned rug, drawn rather than noised: nested borders, a central medallion and repeated
 * motifs, then worn back with noise. The rug is where the window light lands, so a plain one
 * wastes the best surface in the room.
 */
export function createRugMaps(options: { seed?: number; size?: number } = {}): MaterialMaps {
  return cached(`rug:${JSON.stringify(options)}`, () => buildRugMaps(options))
}

function buildRugMaps(options: { seed?: number; size?: number }): MaterialMaps {
  const { seed = 5, size = 1024 } = options

  // Faded antique, not a bright new rug. Low contrast between these is doing most of the
  // work — saturated colour and big crude shapes are what made the first attempt look cheap.
  const ground = '#9B6353'
  const groundAlt = '#8E5A4C'
  const indigo = '#4E5C6B'
  const gold = '#BFA372'
  const cream = '#D8C7A9'

  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(seed * 131)

  ctx.fillStyle = ground
  ctx.fillRect(0, 0, size, size)

  const S = (v: number) => v * size

  // ---- field: a dense lattice of small motifs, the thing real rugs have and mine lacked
  const fieldInset = 0.17
  const cols = 9
  const rows = 9
  const cellW = (1 - fieldInset * 2) / cols
  const cellH = (1 - fieldInset * 2) / rows

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = S(fieldInset + cellW * (c + 0.5))
      const cy = S(fieldInset + cellH * (r + 0.5))
      const rot = ((r + c) % 2) * (Math.PI / 4) + rand() * 0.12
      const scale = S(cellW) * (0.3 + rand() * 0.08)
      const color = (r + c) % 2 === 0 ? cream : gold

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rot)
      ctx.globalAlpha = 0.5 + rand() * 0.25

      // an eight-point star: two overlaid squares, the classic field motif
      ctx.fillStyle = color
      ctx.fillRect(-scale / 2, -scale / 2, scale, scale)
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-scale / 2, -scale / 2, scale, scale)

      ctx.globalAlpha = 0.6
      ctx.fillStyle = indigo
      ctx.beginPath()
      ctx.arc(0, 0, scale * 0.24, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  ctx.globalAlpha = 1

  // ---- borders: several narrow bands, the outer one carrying a repeating motif
  const drawBand = (inset: number, thickness: number, color: string, alpha = 1) => {
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineWidth = S(thickness)
    ctx.strokeRect(S(inset), S(inset), S(1 - inset * 2), S(1 - inset * 2))
    ctx.globalAlpha = 1
  }

  drawBand(0.035, 0.012, indigo)
  drawBand(0.055, 0.006, gold, 0.8)
  drawBand(0.105, 0.03, indigo, 0.85)
  drawBand(0.105, 0.004, gold, 0.7)
  drawBand(0.135, 0.006, cream, 0.6)
  drawBand(0.152, 0.01, indigo, 0.7)

  // repeating hooks along the wide border band
  const hooks = 40
  ctx.globalAlpha = 0.55
  ctx.fillStyle = cream
  for (let i = 0; i < hooks; i += 1) {
    const t = (i + 0.5) / hooks
    const d = S(0.008)
    const positions: [number, number][] = [
      [S(t), S(0.105)],
      [S(t), S(0.895)],
      [S(0.105), S(t)],
      [S(0.895), S(t)],
    ]
    for (const [px, py] of positions) {
      if (px < S(0.1) || px > S(0.9) || py < S(0.1) || py > S(0.9)) continue
      ctx.fillRect(px - d / 2, py - d / 2, d, d)
    }
  }
  ctx.globalAlpha = 1

  // ---- medallion: concentric lobed rosettes rather than one crude star
  const lobed = (radius: number, lobes: number, color: string, alpha: number) => {
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i <= 220; i += 1) {
      const a = (i / 220) * Math.PI * 2
      const r = radius * (1 + 0.17 * Math.cos(a * lobes))
      const px = Math.cos(a) * r
      const py = Math.sin(a) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.save()
  ctx.translate(size / 2, size / 2)
  lobed(S(0.2), 12, indigo, 0.6)
  lobed(S(0.155), 12, groundAlt, 0.85)
  lobed(S(0.115), 8, cream, 0.5)
  lobed(S(0.075), 8, indigo, 0.55)
  ctx.globalAlpha = 0.7
  ctx.fillStyle = gold
  ctx.beginPath()
  ctx.arc(0, 0, S(0.028), 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()

  // ---- corner spandrels
  for (const [cx, cy] of [
    [0.235, 0.235],
    [0.765, 0.235],
    [0.235, 0.765],
    [0.765, 0.765],
  ] as const) {
    ctx.save()
    ctx.translate(S(cx), S(cy))
    lobed(S(0.055), 8, indigo, 0.4)
    lobed(S(0.032), 8, cream, 0.4)
    ctx.restore()
  }

  // wear and pile: knock the pattern back so it reads as woven, not printed
  const wear = makeFbm(seed, 128)
  const pile = makeFbm(seed + 11, 128)
  const image = ctx.getImageData(0, 0, size, size)
  const height = new Float32Array(size * size)
  const rough = new Float32Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const w = wear(u * 4, v * 4, 4) - 0.5
      // Strong horizontal streaking reads as the weave direction.
      const knots = pile(u * 220, v * 100, 2) - 0.5
      const shade = 1 + w * 0.14 + knots * 0.12

      // Traffic wear: the middle of a rug fades most, and worn pile means the pattern is
      // partly lifted back toward the ground colour rather than merely darkened.
      const dx = (u - 0.5) * 2
      const dy = (v - 0.5) * 2
      const centre = Math.max(0, 1 - Math.hypot(dx, dy) * 1.25)
      const fade = 0.28 * centre + 0.14 * Math.max(0, w)

      const i = (y * size + x) * 4
      for (let ch = 0; ch < 3; ch += 1) {
        const base = image.data[i + ch] * shade
        const faded = base * (1 - fade) + [155, 99, 83][ch] * fade
        image.data[i + ch] = Math.max(0, Math.min(255, faded))
      }

      height[y * size + x] = 0.5 + knots * 0.8
      rough[y * size + x] = 0.95 + knots * 0.05
    }
  }
  ctx.putImageData(image, 0, 0)

  return {
    map: finish(canvas, 1, true),
    normalMap: heightToNormalTexture(height, size, 1.2, 1),
    roughnessMap: grayscaleTexture(rough, size, 1),
  }
}

/** Painted plaster: broad tonal drift plus a fine tooth, deliberately low contrast. */
export function createPlasterMaps(
  options: { seed?: number; color?: string; size?: number; repeat?: number } = {},
): MaterialMaps {
  return cached(`plaster:${JSON.stringify(options)}`, () => buildPlasterMaps(options))
}

function buildPlasterMaps(options: {
  seed?: number
  color?: string
  size?: number
  repeat?: number
}): MaterialMaps {
  const { seed = 23, color = '#F3E4D0', size = 512, repeat = 1 } = options

  const broad = makeFbm(seed)
  const tooth = makeFbm(seed + 57, 128)
  const base = hexToRgb(color)

  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  const height = new Float32Array(size * size)
  const rough = new Float32Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size

      const drift = broad(u * 2.2, v * 2.2, 4) - 0.5
      const grain = tooth(u * 90, v * 90, 2) - 0.5
      const shade = 1 + drift * 0.09 + grain * 0.05

      const i = (y * size + x) * 4
      image.data[i] = Math.max(0, Math.min(255, base.r * shade))
      image.data[i + 1] = Math.max(0, Math.min(255, base.g * shade))
      image.data[i + 2] = Math.max(0, Math.min(255, base.b * shade))
      image.data[i + 3] = 255

      height[y * size + x] = 0.5 + grain * 0.6 + drift * 0.2
      rough[y * size + x] = 0.9 + grain * 0.08
    }
  }

  ctx.putImageData(image, 0, 0)

  return {
    map: finish(canvas, repeat, true),
    normalMap: heightToNormalTexture(height, size, 0.7, repeat),
    roughnessMap: grayscaleTexture(rough, size, repeat),
  }
}

/** Paper / cloth book covers: soft fibre grain, no strong features. */
export function createPaperMaps(
  options: { seed?: number; color?: string; size?: number } = {},
): MaterialMaps {
  return cached(`paper:${JSON.stringify(options)}`, () => buildPaperMaps(options))
}

function buildPaperMaps(options: { seed?: number; color?: string; size?: number }): MaterialMaps {
  const { seed = 91, color = '#EADFC8', size = 256 } = options

  const fibre = makeFbm(seed, 128)
  const blotch = makeFbm(seed + 13)
  const base = hexToRgb(color)

  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  const height = new Float32Array(size * size)
  const rough = new Float32Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size

      const f = fibre(u * 70, v * 70, 3) - 0.5
      const b = blotch(u * 3, v * 3, 3) - 0.5
      const shade = 1 + f * 0.09 + b * 0.07

      const i = (y * size + x) * 4
      image.data[i] = Math.max(0, Math.min(255, base.r * shade))
      image.data[i + 1] = Math.max(0, Math.min(255, base.g * shade))
      image.data[i + 2] = Math.max(0, Math.min(255, base.b * shade))
      image.data[i + 3] = 255

      height[y * size + x] = 0.5 + f * 0.5
      rough[y * size + x] = 0.82 + f * 0.1
    }
  }

  ctx.putImageData(image, 0, 0)

  return {
    map: finish(canvas, 1, true),
    normalMap: heightToNormalTexture(height, size, 0.5, 1),
    roughnessMap: grayscaleTexture(rough, size, 1),
  }
}

/**
 * Heavy velvet: a vertical nap that catches light in bands, plus broad sheen variation. Left
 * near-white so the drape colour comes from the material tint.
 */
export function createVelvetMaps(
  options: { seed?: number; size?: number; repeat?: number } = {},
): MaterialMaps {
  return cached(`velvet:${JSON.stringify(options)}`, () => buildVelvetMaps(options))
}

function buildVelvetMaps(options: {
  seed?: number
  size?: number
  repeat?: number
}): MaterialMaps {
  const { seed = 55, size = 512, repeat = 1 } = options

  const nap = makeFbm(seed, 128)
  const broad = makeFbm(seed + 9)

  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  const height = new Float32Array(size * size)
  const rough = new Float32Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size

      // Strongly vertical: velvet pile falls in columns and that is what reads as velvet.
      const pile = nap(u * 120, v * 5, 3) - 0.5
      const fold = broad(u * 5, v * 1.6, 4) - 0.5
      const shade = 1 + fold * 0.42 + pile * 0.16

      const i = (y * size + x) * 4
      const value = Math.max(0, Math.min(255, 226 * shade))
      image.data[i] = value
      image.data[i + 1] = value * 0.99
      image.data[i + 2] = value * 0.97
      image.data[i + 3] = 255

      height[y * size + x] = 0.5 + pile * 0.55 + fold * 0.3
      // Sheen: the crowns of the folds are smoother and catch the light.
      rough[y * size + x] = 0.78 - fold * 0.3
    }
  }

  ctx.putImageData(image, 0, 0)

  return {
    map: finish(canvas, repeat, true),
    normalMap: heightToNormalTexture(height, size, 1.1, repeat),
    roughnessMap: grayscaleTexture(rough, size, repeat),
  }
}

/**
 * An ornate scalloped valance drawn with real transparency: damask motifs, gold trim along
 * every scallop and a bullion fringe beneath. Alpha does the shaping, so the whole thing is
 * one plane rather than carved geometry.
 */
export function createValanceTexture(): Texture {
  const cachedTexture = valanceCache
  if (cachedTexture) return cachedTexture

  const W = 1024
  const H = 384
  const canvas = createCanvas(1)
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const scallops = 7
  const bodyH = H * 0.52
  const scallopDepth = H * 0.2
  const step = W / scallops

  // ---- silhouette
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(W, 0)
  ctx.lineTo(W, bodyH)
  for (let i = scallops - 1; i >= 0; i -= 1) {
    const x1 = i * step
    const cx = x1 + step / 2
    ctx.quadraticCurveTo(cx, bodyH + scallopDepth, x1, bodyH)
  }
  ctx.closePath()

  const body = ctx.createLinearGradient(0, 0, 0, bodyH + scallopDepth)
  body.addColorStop(0, '#C69A55')
  body.addColorStop(0.45, '#A87B41')
  body.addColorStop(1, '#8A6132')
  ctx.fillStyle = body
  ctx.fill()

  // ---- damask motifs across the body
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = 'rgba(214, 178, 106, 0.55)'
  ctx.fillStyle = 'rgba(214, 178, 106, 0.4)'
  for (let i = 0; i < scallops; i += 1) {
    const cx = i * step + step / 2
    const cy = bodyH * 0.55
    ctx.save()
    ctx.translate(cx, cy)
    ctx.lineWidth = 3
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.scale(side, 1)
      ctx.beginPath()
      ctx.moveTo(0, bodyH * 0.3)
      ctx.bezierCurveTo(step * 0.16, bodyH * 0.16, step * 0.26, -bodyH * 0.04, step * 0.2, -bodyH * 0.26)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(step * 0.19, -bodyH * 0.06, step * 0.055, bodyH * 0.09, -0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.beginPath()
    ctx.ellipse(0, -bodyH * 0.12, step * 0.05, bodyH * 0.14, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()

  // ---- gold braid following the scalloped edge
  ctx.beginPath()
  ctx.moveTo(W, bodyH)
  for (let i = scallops - 1; i >= 0; i -= 1) {
    const x1 = i * step
    const cx = x1 + step / 2
    ctx.quadraticCurveTo(cx, bodyH + scallopDepth, x1, bodyH)
  }
  ctx.strokeStyle = '#D9B36A'
  ctx.lineWidth = 7
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 232, 180, 0.6)'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // ---- braid along the top
  ctx.fillStyle = '#C9A227'
  ctx.fillRect(0, 0, W, 10)
  ctx.fillStyle = 'rgba(255,236,190,0.5)'
  ctx.fillRect(0, 10, W, 3)

  // ---- bullion fringe hanging from each scallop
  ctx.strokeStyle = '#C9A227'
  ctx.lineWidth = 2.4
  for (let i = 0; i < scallops; i += 1) {
    const cx = i * step + step / 2
    for (let k = -9; k <= 9; k += 1) {
      const t = k / 9
      const x = cx + t * step * 0.44
      // fringe follows the scallop's curve, longest at the middle
      const yTop = bodyH + scallopDepth * (1 - t * t) - 2
      const len = H * 0.1 * (1 - Math.abs(t) * 0.35)
      ctx.beginPath()
      ctx.moveTo(x, yTop)
      ctx.lineTo(x + t * 3, yTop + len)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x + t * 3, yTop + len + 3, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#E0C07A'
      ctx.fill()
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  valanceCache = texture
  return texture
}

let valanceCache: Texture | null = null

/**
 * A carved-and-gilded picture frame, drawn with a transparent centre so the picture shows
 * through. Layered mouldings, acanthus corners and mid-edge cartouches — the ornament is
 * painted into the texture because geometry could never carry this much detail affordably.
 */
export function createGiltFrameTexture(width = 1024, height = 700): Texture {
  const key = `${width}x${height}`
  const hit = giltFrameCache.get(key)
  if (hit) return hit

  const canvas = createCanvas(1)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const border = Math.min(width, height) * 0.155
  const W = width
  const H = height

  const goldFace = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, '#F0D89A')
    g.addColorStop(0.28, '#D6AE5F')
    g.addColorStop(0.55, '#A97C31')
    g.addColorStop(0.78, '#D9B468')
    g.addColorStop(1, '#8A6222')
    return g
  }

  // ---- frame body
  ctx.fillStyle = goldFace(0, 0, W * 0.35, H)
  ctx.fillRect(0, 0, W, H)

  // ---- layered mouldings: alternating light and dark rules read as carved steps
  const rules: [number, string, number][] = [
    [0.012, '#6E4E1B', 5],
    [0.03, '#F3DFAB', 3],
    [0.055, '#8A6222', 7],
    [0.085, '#EBD096', 3],
    [0.115, '#7A5620', 5],
  ]
  for (const [inset, color, lw] of rules) {
    ctx.strokeStyle = color
    ctx.lineWidth = Math.min(W, H) * (lw / 400)
    ctx.strokeRect(W * inset, H * (inset * (W / H)), W * (1 - inset * 2), H * (1 - inset * (W / H) * 2))
  }

  // ---- a bead course just outside the opening
  const openX = border
  const openY = border
  const openW = W - border * 2
  const openH = H - border * 2

  ctx.fillStyle = '#F2DDA6'
  const beadR = border * 0.075
  const beadStep = beadR * 3.4
  for (let x = openX - beadR * 1.6; x <= openX + openW + beadR * 1.6; x += beadStep) {
    for (const y of [openY - beadR * 1.6, openY + openH + beadR * 1.6]) {
      ctx.beginPath()
      ctx.arc(x, y, beadR, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  for (let y = openY - beadR * 1.6; y <= openY + openH + beadR * 1.6; y += beadStep) {
    for (const x of [openX - beadR * 1.6, openX + openW + beadR * 1.6]) {
      ctx.beginPath()
      ctx.arc(x, y, beadR, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ---- acanthus at each corner
  const corners: [number, number, number][] = [
    [0, 0, 0],
    [W, 0, Math.PI / 2],
    [W, H, Math.PI],
    [0, H, -Math.PI / 2],
  ]
  for (const [cx, cy, rot] of corners) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    drawAcanthus(ctx, border * 2.1)
    ctx.restore()
  }

  // ---- cartouches at the middle of each edge
  const mids: [number, number, number, number][] = [
    [W / 2, border * 0.5, 0, border * 1.5],
    [W / 2, H - border * 0.5, Math.PI, border * 1.5],
    [border * 0.5, H / 2, -Math.PI / 2, border * 1.25],
    [W - border * 0.5, H / 2, Math.PI / 2, border * 1.25],
  ]
  for (const [cx, cy, rot, s] of mids) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    drawCartouche(ctx, s)
    ctx.restore()
  }

  // ---- inner gilt lip, then punch the opening through
  ctx.strokeStyle = '#6B4A19'
  ctx.lineWidth = Math.min(W, H) * 0.006
  ctx.strokeRect(openX, openY, openW, openH)

  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  ctx.fillRect(openX + 2, openY + 2, openW - 4, openH - 4)
  ctx.globalCompositeOperation = 'source-over'

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  giltFrameCache.set(key, texture)
  return texture
}

const giltFrameCache = new Map<string, Texture>()

/**
 * A carved rococo mirror frame: a gilt band with scrollwork breaking its outline, a crest at
 * the head and a cartouche at the foot. Transparent centre, so the reflective glass shows
 * through. Same reasoning as the picture frame — carved ornament belongs in a texture.
 */
export function createMirrorFrameTexture(width = 560, height = 1060): Texture {
  const key = `mirror:${width}x${height}`
  const hit = giltFrameCache.get(key)
  if (hit) return hit

  const canvas = createCanvas(1)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const W = width
  const H = height
  const band = Math.min(W, H) * 0.115
  const crest = H * 0.085

  const gold = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, '#F6E3AE')
    g.addColorStop(0.25, '#DCB877')
    g.addColorStop(0.5, '#B08A3C')
    g.addColorStop(0.75, '#E4C57E')
    g.addColorStop(1, '#8E6B26')
    return g
  }

  const rounded = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  // ---- the frame band
  ctx.fillStyle = gold(0, 0, W * 0.4, H)
  rounded(band * 0.35, crest, W - band * 0.7, H - crest * 2, band * 0.9)
  ctx.fill()

  // inner mouldings before the opening is punched
  ctx.strokeStyle = '#7C5B1E'
  ctx.lineWidth = 4
  rounded(band * 0.9, crest + band * 0.5, W - band * 1.8, H - crest * 2 - band, band * 0.6)
  ctx.stroke()
  ctx.strokeStyle = '#F7E7B6'
  ctx.lineWidth = 2
  rounded(band * 1.05, crest + band * 0.65, W - band * 2.1, H - crest * 2 - band * 1.3, band * 0.55)
  ctx.stroke()

  // ---- scroll ornaments breaking the outline down each side
  const sideCount = 5
  for (let i = 0; i < sideCount; i += 1) {
    const t = (i + 0.5) / sideCount
    const y = crest + (H - crest * 2) * t
    for (const side of [0, 1]) {
      ctx.save()
      ctx.translate(side === 0 ? band * 0.5 : W - band * 0.5, y)
      ctx.rotate(side === 0 ? Math.PI : 0)
      drawSideScroll(ctx, band * 1.5)
      ctx.restore()
    }
  }

  // ---- corners
  for (const [cx, cy, rot] of [
    [band * 0.5, crest + band * 0.4, 0],
    [W - band * 0.5, crest + band * 0.4, Math.PI / 2],
    [W - band * 0.5, H - crest - band * 0.4, Math.PI],
    [band * 0.5, H - crest - band * 0.4, -Math.PI / 2],
  ] as const) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    drawAcanthus(ctx, band * 1.9)
    ctx.restore()
  }

  // ---- crest at the head, cartouche at the foot
  ctx.save()
  ctx.translate(W / 2, crest * 0.95)
  drawCrest(ctx, W * 0.34)
  ctx.restore()

  ctx.save()
  ctx.translate(W / 2, H - crest * 0.95)
  ctx.rotate(Math.PI)
  drawCrest(ctx, W * 0.27)
  ctx.restore()

  // ---- punch the glass opening
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  rounded(band * 1.25, crest + band * 0.85, W - band * 2.5, H - crest * 2 - band * 1.7, band * 0.5)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  giltFrameCache.set(key, texture)
  return texture
}

/** A C-scroll with leaves, projecting sideways off the frame band. */
function drawSideScroll(ctx: CanvasRenderingContext2D, size: number) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(1, side)
    ctx.strokeStyle = '#E9CC8A'
    ctx.lineWidth = size * 0.13
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(size * 0.34, size * 0.06, size * 0.5, size * 0.3, size * 0.3, size * 0.44)
    ctx.stroke()

    ctx.strokeStyle = '#8E6B26'
    ctx.lineWidth = size * 0.05
    ctx.stroke()

    ctx.fillStyle = '#F2DFA8'
    ctx.beginPath()
    ctx.ellipse(size * 0.36, size * 0.24, size * 0.16, size * 0.07, 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/** The plumed crest that sits over the head of the frame. */
function drawCrest(ctx: CanvasRenderingContext2D, size: number) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // fan of leaves rising from the centre
  for (let i = -3; i <= 3; i += 1) {
    const t = i / 3
    ctx.save()
    ctx.rotate(t * 0.85)
    ctx.strokeStyle = i % 2 === 0 ? '#F2DFA8' : '#B08A3C'
    ctx.lineWidth = size * (0.055 - Math.abs(t) * 0.018)
    ctx.beginPath()
    ctx.moveTo(0, size * 0.12)
    ctx.quadraticCurveTo(size * 0.06, -size * 0.16, 0, -size * (0.34 - Math.abs(t) * 0.1))
    ctx.stroke()

    ctx.fillStyle = i % 2 === 0 ? 'rgba(242,223,168,0.9)' : 'rgba(176,138,60,0.9)'
    ctx.beginPath()
    ctx.ellipse(0, -size * (0.28 - Math.abs(t) * 0.08), size * 0.05, size * 0.11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // shell at the base of the crest
  ctx.fillStyle = '#E9CC8A'
  ctx.beginPath()
  ctx.ellipse(0, size * 0.16, size * 0.24, size * 0.15, 0, Math.PI, 0)
  ctx.fill()
  ctx.strokeStyle = '#8E6B26'
  ctx.lineWidth = size * 0.02
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath()
    ctx.moveTo(0, size * 0.16)
    ctx.lineTo(i * size * 0.07, size * 0.02)
    ctx.stroke()
  }
}

/** A corner acanthus: a fan of curling leaves radiating along the diagonal. */
function drawAcanthus(ctx: CanvasRenderingContext2D, size: number) {
  ctx.save()
  ctx.rotate(Math.PI / 4)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(1, side)

    for (let k = 0; k < 3; k += 1) {
      const s = size * (0.9 - k * 0.22)
      ctx.strokeStyle = k === 1 ? '#F3E0B0' : '#7C5720'
      ctx.lineWidth = size * (0.05 - k * 0.008)
      ctx.beginPath()
      ctx.moveTo(size * 0.06, size * 0.04)
      ctx.bezierCurveTo(s * 0.34, s * 0.1, s * 0.5, s * 0.3, s * 0.42, s * 0.52)
      ctx.stroke()

      // leaf blade
      ctx.fillStyle = k === 1 ? 'rgba(243,224,176,0.85)' : 'rgba(140,101,40,0.85)'
      ctx.beginPath()
      ctx.ellipse(s * 0.36, s * 0.34, s * 0.15, s * 0.06, 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // central rosette
  ctx.fillStyle = '#EBD096'
  ctx.beginPath()
  ctx.arc(size * 0.2, 0, size * 0.09, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8A6222'
  ctx.beginPath()
  ctx.arc(size * 0.2, 0, size * 0.045, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

/** A small shell-and-scroll cartouche for the middle of an edge. */
function drawCartouche(ctx: CanvasRenderingContext2D, size: number) {
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)
    ctx.strokeStyle = '#F3E0B0'
    ctx.lineWidth = size * 0.055
    ctx.beginPath()
    ctx.moveTo(0, size * 0.26)
    ctx.bezierCurveTo(size * 0.24, size * 0.2, size * 0.42, size * 0.04, size * 0.36, -size * 0.16)
    ctx.stroke()

    ctx.fillStyle = 'rgba(150,110,45,0.9)'
    ctx.beginPath()
    ctx.ellipse(size * 0.3, size * 0.02, size * 0.12, size * 0.05, 0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.fillStyle = '#F0D89A'
  ctx.beginPath()
  ctx.ellipse(0, size * 0.06, size * 0.1, size * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8A6222'
  ctx.beginPath()
  ctx.ellipse(0, size * 0.06, size * 0.045, size * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
}

export interface SpineMaps {
  /** Neutral leather, tinted per book through the material colour. */
  map: Texture
  /** White where gilt, black elsewhere. Drives emissive and metalness at once. */
  gilt: Texture
  roughnessMap: Texture
}

const spineCache = new Map<number, SpineMaps>()

/**
 * A tooled antique binding, drawn rather than modelled. Ornament this fine is impossible as
 * primitive geometry, but as a mask it costs nothing: one shared texture set makes every book
 * gilt, while the leather colour still varies per book through `material.color`.
 *
 * Five raised bands divide the spine into six panels; the panels carry foliate fleurons, with
 * a bordered title label near the head.
 */
export function createSpineMaps(variant = 0): SpineMaps {
  const hit = spineCache.get(variant)
  if (hit) return hit

  const W = 160
  const H = 768

  const leatherCanvas = document.createElement('canvas')
  leatherCanvas.width = W
  leatherCanvas.height = H
  const lc = leatherCanvas.getContext('2d')!

  const giltCanvas = document.createElement('canvas')
  giltCanvas.width = W
  giltCanvas.height = H
  const gc = giltCanvas.getContext('2d')!

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = W
  roughCanvas.height = H
  const rc = roughCanvas.getContext('2d')!

  // --- leather: near-white so the material colour reads true, with mottled patina
  const grain = makeFbm(variant * 17 + 5, 128)
  lc.fillStyle = '#FFFFFF'
  lc.fillRect(0, 0, W, H)
  const leather = lc.getImageData(0, 0, W, H)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const u = x / W
      const v = y / H
      const patina = grain(u * 6, v * 26, 4) - 0.5
      const scuff = grain(u * 30, v * 120, 2) - 0.5
      const shade = 1 + patina * 0.3 + scuff * 0.12
      const i = (y * W + x) * 4
      const value = Math.max(0, Math.min(255, 232 * shade))
      leather.data[i] = value
      leather.data[i + 1] = value * 0.985
      leather.data[i + 2] = value * 0.96
      leather.data[i + 3] = 255
    }
  }
  lc.putImageData(leather, 0, 0)

  // --- gilt mask
  gc.fillStyle = '#000000'
  gc.fillRect(0, 0, W, H)
  gc.strokeStyle = '#FFFFFF'
  gc.fillStyle = '#FFFFFF'

  const bands = [0.145, 0.315, 0.485, 0.655, 0.825]
  const rule = (y: number, inset: number, thickness: number) => {
    gc.fillRect(W * inset, y - thickness / 2, W * (1 - inset * 2), thickness)
  }

  // gilt fillets either side of every raised band
  for (const t of bands) {
    const y = H * t
    rule(y - H * 0.016, 0.1, 2.2)
    rule(y + H * 0.016, 0.1, 2.2)
  }

  // head and tail rules
  rule(H * 0.028, 0.1, 2.6)
  rule(H * 0.045, 0.1, 1.6)
  rule(H * 0.972, 0.1, 2.6)
  rule(H * 0.955, 0.1, 1.6)

  const panelCentres = [0.086, 0.23, 0.4, 0.57, 0.74, 0.9]

  panelCentres.forEach((t, index) => {
    const cy = H * t
    // second panel from the head carries the title label
    if (index === 1) {
      const boxH = H * 0.108
      gc.lineWidth = 2.4
      gc.strokeRect(W * 0.14, cy - boxH / 2, W * 0.72, boxH)
      gc.lineWidth = 1.2
      gc.strokeRect(W * 0.18, cy - boxH / 2 + 5, W * 0.64, boxH - 10)
      // two rules standing in for lettering — no readable text in the scene
      gc.fillRect(W * 0.26, cy - H * 0.014, W * 0.48, 3.4)
      gc.fillRect(W * 0.32, cy + H * 0.008, W * 0.36, 2.6)
      return
    }
    drawFleuron(gc, W / 2, cy, W * 0.78, H * 0.115, index % 2 === 0)
  })

  // --- roughness: gilt is polished, leather is not
  rc.fillStyle = '#D8D8D8'
  rc.fillRect(0, 0, W, H)
  rc.drawImage(giltCanvas, 0, 0)
  rc.globalCompositeOperation = 'difference'
  rc.fillStyle = '#FFFFFF'
  rc.fillRect(0, 0, W, H)
  rc.globalCompositeOperation = 'source-over'

  const wrap = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const texture = new CanvasTexture(canvas)
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.anisotropy = 8
    if (srgb) texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }

  const maps: SpineMaps = {
    map: wrap(leatherCanvas, true),
    gilt: wrap(giltCanvas, false),
    roughnessMap: wrap(roughCanvas, false),
  }

  spineCache.set(variant, maps)
  return maps
}

/** A symmetric foliate ornament: mirrored scroll arms, leaves and a central stem. */
function drawFleuron(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  flourish: boolean,
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#FFFFFF'
  ctx.fillStyle = '#FFFFFF'

  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)

    // main scroll arm sweeping out and curling back
    ctx.lineWidth = Math.max(1.4, w * 0.045)
    ctx.beginPath()
    ctx.moveTo(0, h * 0.34)
    ctx.bezierCurveTo(w * 0.17, h * 0.24, w * 0.32, h * 0.07, w * 0.31, -h * 0.09)
    ctx.bezierCurveTo(w * 0.3, -h * 0.24, w * 0.16, -h * 0.31, w * 0.07, -h * 0.22)
    ctx.stroke()

    // inner curl
    ctx.lineWidth = Math.max(1, w * 0.03)
    ctx.beginPath()
    ctx.moveTo(w * 0.06, h * 0.18)
    ctx.bezierCurveTo(w * 0.19, h * 0.09, w * 0.22, -h * 0.03, w * 0.13, -h * 0.1)
    ctx.stroke()

    // leaves along the arm
    const leaves: [number, number, number, number][] = [
      [w * 0.23, h * 0.15, w * 0.075, -0.7],
      [w * 0.32, -h * 0.02, w * 0.062, -0.1],
      [w * 0.17, -h * 0.23, w * 0.05, 0.5],
    ]
    for (const [lx, ly, lr, rot] of leaves) {
      ctx.beginPath()
      ctx.ellipse(lx, ly, lr, lr * 0.46, rot, 0, Math.PI * 2)
      ctx.fill()
    }

    if (flourish) {
      ctx.lineWidth = Math.max(1, w * 0.022)
      ctx.beginPath()
      ctx.moveTo(w * 0.04, -h * 0.02)
      ctx.quadraticCurveTo(w * 0.2, -h * 0.16, w * 0.28, -h * 0.34)
      ctx.stroke()
    }

    ctx.restore()
  }

  // central stem with finials
  ctx.lineWidth = Math.max(1.2, w * 0.04)
  ctx.beginPath()
  ctx.moveTo(0, h * 0.36)
  ctx.lineTo(0, -h * 0.32)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, -h * 0.37, w * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, h * 0.4, w * 0.042, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

export function disposeMaps(maps: MaterialMaps) {
  maps.map.dispose()
  maps.normalMap.dispose()
  maps.roughnessMap.dispose()
}
