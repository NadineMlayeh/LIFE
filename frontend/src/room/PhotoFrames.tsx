import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, TextureLoader, type Group, type Texture } from 'three'
import { PALETTE, hashString } from './palette'
import { createGiltFrameTexture } from './textures'

/** A quiet placeholder so an empty gallery still reads as framed pictures, not blank card. */
function createMountTexture(seed: number): Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const tone = 200 + Math.floor(hashString(`mount:${seed}`) * 30)
  const gradient = ctx.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, `rgb(${tone}, ${tone - 12}, ${tone - 28})`)
  gradient.addColorStop(1, `rgb(${tone - 26}, ${tone - 34}, ${tone - 46})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const FRAME_W = 1.22
const FRAME_H = 0.86

export function PhotoFrames({
  position,
  rotation = [0, 0, 0],
  featuredUrl,
  onOpen,
  onHover,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  /** Object URL of the user's featured photo, shown in the largest frame. */
  featuredUrl: string | null
  onOpen: () => void
  onHover: (label: string | null) => void
}) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const [featured, setFeatured] = useState<Texture | null>(null)

  const giltFrame = useMemo(() => createGiltFrameTexture(1024, 720), [])
  const mount = useMemo(() => createMountTexture(3), [])

  /*
    A Texture holds an image uploaded to the GPU, and dropping the JavaScript reference does
    not release it — only `dispose()` does. The frame reloads whenever a different photograph
    is hung, so without this every re-hang left the previous one resident in video memory for
    the life of the page.

    The cleanup also covers the race where the effect re-runs before the load finishes: the
    late arrival is disposed on the spot rather than being handed to a component that has
    moved on.
  */
  useEffect(() => {
    if (!featuredUrl) {
      setFeatured(null)
      return
    }

    let cancelled = false
    let loaded: Texture | null = null

    new TextureLoader().load(featuredUrl, (texture) => {
      if (cancelled) {
        texture.dispose()
        return
      }
      texture.colorSpace = SRGBColorSpace
      loaded = texture
      setFeatured(texture)
    })

    return () => {
      cancelled = true
      loaded?.dispose()
    }
  }, [featuredUrl])

  useFrame((_, delta) => {
    if (!group.current) return
    const target = hovered ? 1.02 : 1
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
        onHover('Gallery')
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
      {/* backing board, giving the frame real depth against the wall */}
      <mesh position={[0, 0, -0.012]} castShadow receiveShadow>
        <boxGeometry args={[FRAME_W - 0.04, FRAME_H - 0.04, 0.03]} />
        <meshStandardMaterial color="#3A2A1B" roughness={0.75} />
      </mesh>

      {/* the picture, behind the frame's opening */}
      <mesh position={[0, 0, 0.006]}>
        <planeGeometry args={[FRAME_W * 0.7, FRAME_H * 0.68]} />
        <meshStandardMaterial map={featured ?? mount} roughness={0.82} metalness={0} />
      </mesh>

      {/* glazing over the picture */}
      <mesh position={[0, 0, 0.009]}>
        <planeGeometry args={[FRAME_W * 0.7, FRAME_H * 0.68]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.07}
          roughness={0.05}
          metalness={0.1}
        />
      </mesh>

      {/* The carved gilt frame: one plane with a transparent centre, so all the acanthus and
          beading is drawn rather than modelled. */}
      <mesh position={[0, 0, 0.022]} castShadow>
        <planeGeometry args={[FRAME_W, FRAME_H]} />
        <meshStandardMaterial
          map={giltFrame}
          transparent
          alphaTest={0.35}
          roughness={0.3}
          metalness={0.85}
          emissive={PALETTE.brass}
          emissiveIntensity={hovered ? 0.22 : 0.05}
          side={2}
        />
      </mesh>
    </group>
  )
}
