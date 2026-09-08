import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { PALETTE } from './palette'
import { createPaperMaps, createWoodMaps } from './textures'

// A longcase clock standing on the floor: plinth, trunk with a glazed lenticle showing the
// pendulum, and a hood carrying the dial. It reads as *time itself* rather than as a wall
// ornament, which is what the timeline deserves.
const PLINTH_H = 0.46
const TRUNK_H = 1.12
const HOOD_H = 0.56
const TOTAL_H = PLINTH_H + TRUNK_H + HOOD_H

export function LongcaseClock({
  position,
  rotation = [0, 0, 0],
  eventCount,
  onOpen,
  onHover,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  eventCount: number
  onOpen: () => void
  onHover: (label: string | null) => void
}) {
  const group = useRef<Group>(null)
  const hourHand = useRef<Group>(null)
  const minuteHand = useRef<Group>(null)
  const pendulum = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)

  const caseMaps = useMemo(
    () =>
      createWoodMaps({
        seed: 202,
        light: '#7A5232',
        dark: '#43291A',
        size: 512,
        repeat: 1,
        ringFrequency: 10,
        knots: 1,
      }),
    [],
  )

  const dialMaps = useMemo(() => createPaperMaps({ seed: 77, color: '#F0E7D2', size: 256 }), [])

  useFrame((_, delta) => {
    const now = new Date()
    const minutes = now.getMinutes() + now.getSeconds() / 60
    const hours = (now.getHours() % 12) + minutes / 60

    if (hourHand.current) hourHand.current.rotation.z = -(hours / 12) * Math.PI * 2
    if (minuteHand.current) minuteHand.current.rotation.z = -(minutes / 60) * Math.PI * 2

    // A seconds pendulum: one swing per second, so a full cycle takes two.
    if (pendulum.current) {
      const t = now.getSeconds() + now.getMilliseconds() / 1000
      pendulum.current.rotation.z = Math.sin(t * Math.PI) * 0.13
    }

    if (group.current) {
      const target = hovered ? 1.012 : 1
      const k = 1 - Math.pow(0.002, delta)
      const s = group.current.scale.x + (target - group.current.scale.x) * k
      group.current.scale.setScalar(s)
    }
  })

  const wood = (
    <meshStandardMaterial
      map={caseMaps.map}
      normalMap={caseMaps.normalMap}
      roughnessMap={caseMaps.roughnessMap}
      roughness={0.52}
      metalness={0.04}
    />
  )

  const brass = (
    <meshStandardMaterial
      color={PALETTE.brass}
      roughness={0.3}
      metalness={0.9}
      emissive={PALETTE.brass}
      emissiveIntensity={hovered ? 0.28 : 0.06}
    />
  )

  // A fuller chapter ring the more of your life is recorded (spec C.3 — meaningful, not decor).
  const minorTicks = Math.min(60, 12 + Math.round(Math.min(1, eventCount / 60) * 48))

  return (
    <group
      ref={group}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover('Timeline')
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
      {/* ---------- plinth ---------- */}
      <mesh position={[0, PLINTH_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, PLINTH_H, 0.27]} />
        {wood}
      </mesh>
      <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.05, 0.31]} />
        {wood}
      </mesh>
      <mesh position={[0, PLINTH_H, 0]} castShadow>
        <boxGeometry args={[0.47, 0.035, 0.29]} />
        {wood}
      </mesh>
      {/* raised plinth panel */}
      <mesh position={[0, PLINTH_H / 2, 0.142]}>
        <boxGeometry args={[0.3, PLINTH_H * 0.6, 0.012]} />
        <meshStandardMaterial map={caseMaps.map} roughness={0.45} metalness={0.05} />
      </mesh>

      {/* ---------- trunk ---------- */}
      <mesh position={[0, PLINTH_H + TRUNK_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.34, TRUNK_H, 0.23]} />
        {wood}
      </mesh>

      {/* trunk door, slightly proud, with a brass escutcheon */}
      <mesh position={[0, PLINTH_H + TRUNK_H / 2, 0.122]} castShadow>
        <boxGeometry args={[0.27, TRUNK_H * 0.88, 0.018]} />
        <meshStandardMaterial map={caseMaps.map} roughness={0.45} metalness={0.05} />
      </mesh>
      <mesh position={[0.1, PLINTH_H + TRUNK_H / 2, 0.135]}>
        <cylinderGeometry args={[0.014, 0.014, 0.006, 16]} />
        {brass}
      </mesh>

      {/* glazed lenticle — you can see the pendulum swing behind it */}
      <mesh position={[0, PLINTH_H + TRUNK_H * 0.62, 0.133]}>
        <torusGeometry args={[0.062, 0.008, 12, 32]} />
        {brass}
      </mesh>
      <mesh position={[0, PLINTH_H + TRUNK_H * 0.62, 0.134]}>
        <circleGeometry args={[0.06, 32]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.14} roughness={0.05} metalness={0.1} />
      </mesh>

      {/* pendulum, hung from behind the dial */}
      <group ref={pendulum} position={[0, PLINTH_H + TRUNK_H + 0.02, 0.05]}>
        <mesh position={[0, -0.45, 0]}>
          <boxGeometry args={[0.012, 0.9, 0.008]} />
          <meshStandardMaterial color="#B08D4A" roughness={0.45} metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.86, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.062, 0.062, 0.012, 28]} />
          {brass}
        </mesh>
      </group>

      {/* ---------- hood ---------- */}
      <mesh position={[0, PLINTH_H + TRUNK_H + HOOD_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.48, HOOD_H, 0.29]} />
        {wood}
      </mesh>
      <mesh position={[0, PLINTH_H + TRUNK_H + 0.015, 0]} castShadow>
        <boxGeometry args={[0.52, 0.04, 0.32]} />
        {wood}
      </mesh>

      {/* dial: silvered face, brass chapter ring, spandrels at the corners */}
      <mesh position={[0, PLINTH_H + TRUNK_H + HOOD_H * 0.52, 0.148]}>
        <boxGeometry args={[0.36, 0.36, 0.012]} />
        <meshStandardMaterial
          map={dialMaps.map}
          normalMap={dialMaps.normalMap}
          roughness={0.55}
          metalness={0.25}
        />
      </mesh>
      <mesh position={[0, PLINTH_H + TRUNK_H + HOOD_H * 0.52, 0.156]}>
        <torusGeometry args={[0.145, 0.012, 12, 48]} />
        {brass}
      </mesh>
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sy], i) => (
        <mesh
          key={i}
          position={[sx * 0.148, PLINTH_H + TRUNK_H + HOOD_H * 0.52 + sy * 0.148, 0.156]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <boxGeometry args={[0.045, 0.045, 0.005]} />
          {brass}
        </mesh>
      ))}

      {/* chapter marks */}
      {Array.from({ length: minorTicks }).map((_, i) => {
        const angle = (i / minorTicks) * Math.PI * 2
        const major = i % Math.max(1, Math.round(minorTicks / 12)) === 0
        const r = 0.126
        return (
          <mesh
            key={i}
            position={[
              Math.sin(angle) * r,
              PLINTH_H + TRUNK_H + HOOD_H * 0.52 + Math.cos(angle) * r,
              0.157,
            ]}
            rotation={[0, 0, -angle]}
          >
            <boxGeometry args={[major ? 0.009 : 0.004, major ? 0.026 : 0.013, 0.003]} />
            <meshStandardMaterial color="#2E2118" roughness={0.6} />
          </mesh>
        )
      })}

      {/* hands */}
      <group
        ref={hourHand}
        position={[0, PLINTH_H + TRUNK_H + HOOD_H * 0.52, 0.16]}
      >
        <mesh position={[0, 0.035, 0]}>
          <boxGeometry args={[0.011, 0.07, 0.004]} />
          <meshStandardMaterial color="#241A12" roughness={0.5} metalness={0.3} />
        </mesh>
      </group>
      <group
        ref={minuteHand}
        position={[0, PLINTH_H + TRUNK_H + HOOD_H * 0.52, 0.164]}
      >
        <mesh position={[0, 0.052, 0]}>
          <boxGeometry args={[0.007, 0.105, 0.003]} />
          <meshStandardMaterial color="#241A12" roughness={0.5} metalness={0.3} />
        </mesh>
      </group>
      <mesh
        position={[0, PLINTH_H + TRUNK_H + HOOD_H * 0.52, 0.167]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.009, 0.009, 0.008, 16]} />
        {brass}
      </mesh>

      {/* ---------- pediment and finials ---------- */}
      <mesh position={[0, TOTAL_H + 0.02, 0]} castShadow>
        <boxGeometry args={[0.54, 0.05, 0.33]} />
        {wood}
      </mesh>
      {/* a shallow arched crest rather than a flat top */}
      <mesh position={[0, TOTAL_H + 0.1, 0.02]} castShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.28, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial map={caseMaps.map} normalMap={caseMaps.normalMap} roughness={0.5} />
      </mesh>
      {[-0.21, 0, 0.21].map((x, i) => (
        <group key={i} position={[x, TOTAL_H + (i === 1 ? 0.28 : 0.09), 0.02]}>
          <mesh castShadow>
            <sphereGeometry args={[0.03, 16, 12]} />
            {brass}
          </mesh>
          <mesh position={[0, -0.035, 0]}>
            <cylinderGeometry args={[0.016, 0.022, 0.03, 12]} />
            {brass}
          </mesh>
        </group>
      ))}
    </group>
  )
}

export { TOTAL_H as CLOCK_HEIGHT }
