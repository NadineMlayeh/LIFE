import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { createMirrorFrameTexture } from './textures'

const W = 0.96
const H = 1.82

/**
 * A carved giltwood pier glass. The frame is a drawn texture with a transparent centre laid
 * over the reflective glass — the ornament (scrolls, corner acanthus, crest and cartouche) is
 * far beyond what primitive geometry could carry.
 */
export function Mirror({
  position,
  rotation = [0, 0, 0],
  onOpen,
  onHover,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  onOpen: () => void
  onHover: (label: string | null) => void
}) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const frameTexture = useMemo(() => createMirrorFrameTexture(560, 1060), [])

  useFrame((_, delta) => {
    if (!group.current) return
    const target = hovered ? 1.014 : 1
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
        onHover('Identity')
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
      {/* backing board behind the glass */}
      <mesh position={[0, 0, -0.018]} castShadow receiveShadow>
        <boxGeometry args={[W * 0.82, H * 0.88, 0.03]} />
        <meshStandardMaterial color="#3A2A1B" roughness={0.8} />
      </mesh>

      {/* the glass */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[W * 0.74, H * 0.82]} />
        <MeshReflectorMaterial
          resolution={1024}
          mixBlur={0.06}
          mixStrength={1.5}
          blur={[24, 12]}
          depthScale={0}
          color="#D6DEE0"
          metalness={0.5}
          roughness={0.13}
          mirror={0.94}
        />
      </mesh>

      {/* the carved gilt frame, drawn with a transparent centre */}
      <mesh position={[0, 0, 0.016]} castShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial
          map={frameTexture}
          transparent
          alphaTest={0.3}
          roughness={0.3}
          metalness={0.92}
          emissive="#7A5F2C"
          emissiveIntensity={hovered ? 0.3 : 0.16}
          side={2}
        />
      </mesh>
    </group>
  )
}
