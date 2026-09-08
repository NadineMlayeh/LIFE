import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, type Group, type Texture } from 'three'
import { PALETTE } from './palette'
import { createWoodMaps } from './textures'
import { CONTINENTS, COUNTRY_POINTS } from './worldShapes'

const MAP_W = 1.5
const MAP_H = 0.95

/** An engraved antique chart: sepia ground, graticule, coastlines, compass rose, cartouche. */
function createMapTexture(): Texture {
  const W = 1400
  const H = Math.round(W * (MAP_H / MAP_W))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // aged paper
  const paper = ctx.createLinearGradient(0, 0, W, H)
  paper.addColorStop(0, '#EDDFBE')
  paper.addColorStop(0.5, '#E6D4AC')
  paper.addColorStop(1, '#D8C49B')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)

  // foxing blotches
  for (let i = 0; i < 220; i += 1) {
    const x = Math.random() * W
    const y = Math.random() * H
    const r = 3 + Math.random() * 26
    ctx.globalAlpha = 0.035 + Math.random() * 0.05
    ctx.fillStyle = '#9A7A4A'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // graticule
  ctx.strokeStyle = 'rgba(120, 92, 54, 0.28)'
  ctx.lineWidth = 1
  for (let lon = -150; lon <= 150; lon += 30) {
    const x = ((lon + 180) / 360) * W
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * H
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  // equator, heavier
  ctx.strokeStyle = 'rgba(110, 82, 46, 0.5)'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(0, H / 2)
  ctx.lineTo(W, H / 2)
  ctx.stroke()

  // landmasses
  for (const outline of CONTINENTS) {
    ctx.beginPath()
    outline.forEach(([u, v], i) => {
      const x = u * W
      const y = v * H
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = 'rgba(190, 165, 116, 0.72)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(94, 68, 38, 0.75)'
    ctx.lineWidth = 2.2
    ctx.stroke()
    // a lighter inland wash for a little relief
    ctx.save()
    ctx.clip()
    ctx.fillStyle = 'rgba(206, 184, 138, 0.5)'
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }

  // compass rose over the Pacific
  const cx = W * 0.135
  const cy = H * 0.72
  const R = Math.min(W, H) * 0.075
  ctx.strokeStyle = 'rgba(104, 76, 42, 0.6)'
  ctx.fillStyle = 'rgba(104, 76, 42, 0.5)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2
    const long = i % 2 === 0
    const r1 = long ? R * 1.02 : R * 0.6
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    ctx.lineTo(cx + Math.cos(a + 0.14) * r1 * 0.35, cy + Math.sin(a + 0.14) * r1 * 0.35)
    ctx.closePath()
    ctx.fill()
  }

  // cartouche in the lower right
  ctx.strokeStyle = 'rgba(104, 76, 42, 0.55)'
  ctx.lineWidth = 2
  const bx = W * 0.7
  const by = H * 0.8
  ctx.strokeRect(bx, by, W * 0.22, H * 0.12)
  ctx.strokeRect(bx + 6, by + 6, W * 0.22 - 12, H * 0.12 - 12)
  ctx.fillStyle = 'rgba(104, 76, 42, 0.4)'
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(bx + 22, by + 20 + i * 16, (W * 0.22 - 44) * (i === 2 ? 0.55 : 1), 4)
  }

  // border rules
  ctx.strokeStyle = 'rgba(94, 68, 38, 0.8)'
  ctx.lineWidth = 5
  ctx.strokeRect(9, 9, W - 18, H - 18)
  ctx.lineWidth = 1.6
  ctx.strokeRect(20, 20, W - 40, H - 40)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

let mapTextureCache: Texture | null = null
function getMapTexture() {
  if (!mapTextureCache) mapTextureCache = createMapTexture()
  return mapTextureCache
}

export function WorldMap({
  position,
  rotation = [0, 0, 0],
  visited,
  onOpen,
  onHover,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  /** Country codes, with whether they are a past visit or a future destination. */
  visited: { countryCode: string; status: string }[]
  onOpen: () => void
  onHover: (label: string | null) => void
}) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)

  const frameMaps = useMemo(
    () =>
      createWoodMaps({
        seed: 175,
        light: '#8A5F38',
        dark: '#4E3220',
        size: 256,
        repeat: 1,
        ringFrequency: 8,
        knots: 0,
      }),
    [],
  )

  const mapTexture = useMemo(() => getMapTexture(), [])

  const pins = useMemo(
    () =>
      visited
        .map(({ countryCode, status }) => {
          const point = COUNTRY_POINTS[countryCode?.toUpperCase()]
          if (!point) return null
          return {
            countryCode,
            status,
            x: (point[0] - 0.5) * MAP_W,
            y: (0.5 - point[1]) * MAP_H,
          }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [visited],
  )

  useFrame((_, delta) => {
    if (!group.current) return
    const target = hovered ? 1.015 : 1
    const k = 1 - Math.pow(0.002, delta)
    const s = group.current.scale.x + (target - group.current.scale.x) * k
    group.current.scale.setScalar(s)
  })

  return (
    <group
      ref={group}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover('Places')
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        onHover(null)
        document.body.style.cursor = 'auto'
      }}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
    >
      {/* frame */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[MAP_W + 0.12, MAP_H + 0.12, 0.05]} />
        <meshStandardMaterial
          map={frameMaps.map}
          normalMap={frameMaps.normalMap}
          roughnessMap={frameMaps.roughnessMap}
          roughness={0.5}
        />
      </mesh>
      {/* gilt slip */}
      <mesh position={[0, 0, 0.026]}>
        <boxGeometry args={[MAP_W + 0.03, MAP_H + 0.03, 0.006]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.32}
          metalness={0.88}
          emissive={PALETTE.brass}
          emissiveIntensity={hovered ? 0.24 : 0.05}
        />
      </mesh>
      {/* the chart itself */}
      <mesh position={[0, 0, 0.031]}>
        <planeGeometry args={[MAP_W, MAP_H]} />
        <meshStandardMaterial map={mapTexture} roughness={0.9} metalness={0} />
      </mesh>
      {/* glazing */}
      <mesh position={[0, 0, 0.034]}>
        <planeGeometry args={[MAP_W, MAP_H]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.07} roughness={0.05} metalness={0.1} />
      </mesh>

      {/* pins: brass for places visited, dark for places still to go */}
      {pins.map((pin) => (
        <group key={pin.countryCode} position={[pin.x, pin.y, 0.036]}>
          <mesh>
            <sphereGeometry args={[0.014, 12, 10]} />
            <meshStandardMaterial
              color={pin.status === 'future' ? '#5C6B7A' : PALETTE.brass}
              roughness={0.28}
              metalness={0.85}
              emissive={pin.status === 'future' ? '#33414F' : PALETTE.brass}
              emissiveIntensity={0.3}
            />
          </mesh>
          <mesh position={[0, 0, -0.006]}>
            <cylinderGeometry args={[0.003, 0.003, 0.012, 6]} />
            <meshStandardMaterial color="#6E5836" roughness={0.4} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* picture light above, as in the reference */}
      <group position={[0, MAP_H / 2 + 0.12, 0.14]}>
        <mesh rotation={[0.5, 0, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.34, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={0.9} side={2} />
        </mesh>
        <mesh position={[0, 0.06, -0.06]}>
          <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
          <meshStandardMaterial color={PALETTE.brass} roughness={0.35} metalness={0.85} />
        </mesh>
        <pointLight position={[0, -0.06, 0.05]} color="#FFE2B0" intensity={0.5} distance={2.2} decay={2} />
      </group>
    </group>
  )
}
