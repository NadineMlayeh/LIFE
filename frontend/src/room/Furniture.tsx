import { useMemo } from 'react'
import { BoxGeometry, DoubleSide, Shape, ShapeGeometry, Vector3, type BufferGeometry } from 'three'
import { hashString } from './palette'
import { createVelvetMaps, createWoodMaps } from './textures'

/**
 * A single leaf silhouette: broad at the base, tapering to a point. Scaled ellipsoids gave
 * every plant rounded, bulbous tips, which is most of why they read as toys — real foliage is
 * flat and pointed, and reads far better even at this level of simplification.
 */
const LEAF_GEOMETRY = (() => {
  const s = new Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.34, 0.12, 0.42, 0.58, 0, 1)
  s.bezierCurveTo(-0.42, 0.58, -0.34, 0.12, 0, 0)
  return new ShapeGeometry(s, 14)
})()

const FOLIAGE_TONES = ['#3E5836', '#4A6B41', '#33502E', '#56774A', '#2E4629'] as const

/**
 * A cushion, not a cube: a subdivided box whose vertices are eased toward a sphere. Corners
 * round off and the faces bulge, which is exactly how a stuffed cushion behaves — flat box
 * faces and hard corners are what made the scatter pillows read as blocks.
 *
 * `plump` controls how far toward the sphere the vertices travel.
 */
const cushionCache = new Map<string, BufferGeometry>()

function cushionGeometry(w: number, h: number, d: number, plump = 0.42): BufferGeometry {
  const key = `${w}:${h}:${d}:${plump}`
  const hit = cushionCache.get(key)
  if (hit) return hit

  const geometry = new BoxGeometry(1, 1, 1, 10, 10, 10)
  const pos = geometry.attributes.position
  const v = new Vector3()

  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i)
    const spherical = v.clone().normalize().multiplyScalar(0.5)
    v.lerp(spherical, plump)
    pos.setXYZ(i, v.x, v.y, v.z)
  }

  pos.needsUpdate = true
  geometry.scale(w, h, d)
  geometry.computeVertexNormals()
  cushionCache.set(key, geometry)
  return geometry
}

/**
 * A buttoned Chesterfield in velvet. Purely furniture — it carries no data, it is there
 * because a room with nothing to sit on reads as a showroom.
 */
export function Couch({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  const velvet = useMemo(() => createVelvetMaps({ seed: 71, size: 256, repeat: 1 }), [])
  const legMaps = useMemo(
    () =>
      createWoodMaps({
        seed: 12,
        light: '#6B4A2E',
        dark: '#3E2818',
        size: 128,
        repeat: 1,
        ringFrequency: 6,
        knots: 0,
      }),
    [],
  )

  const W = 1.78
  const D = 0.84
  const seatH = 0.38

  // Warm taupe, a shade or two below the ceramic pots. Cream was too loud, brown vanished
  // into the joinery and green was the wrong note entirely.
  const upholstery = (
    <meshStandardMaterial
      map={velvet.map}
      normalMap={velvet.normalMap}
      roughnessMap={velvet.roughnessMap}
      color="#BCA88C"
      roughness={0.84}
      metalness={0.04}
      normalScale={[0.7, 0.7]}
    />
  )

  const buttons: [number, number][] = []
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const stagger = row % 2 === 0 ? 0 : 0.5
      buttons.push([(col + stagger - 2.75) * 0.3, 0.62 + row * 0.16])
    }
  }

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, seatH * 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, seatH, D]} />
        {upholstery}
      </mesh>

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * W * 0.24, seatH + 0.06, 0.02]}
          geometry={cushionGeometry(W * 0.45, 0.16, D * 0.83, 0.26)}
          castShadow
        >
          {upholstery}
        </mesh>
      ))}

      <mesh position={[0, 0.72, -D / 2 + 0.12]} rotation={[-0.08, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, 0.7, 0.22]} />
        {upholstery}
      </mesh>
      <mesh position={[0, 1.05, -D / 2 + 0.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, W, 20]} />
        {upholstery}
      </mesh>

      {buttons.map(([bx, by], i) => (
        <mesh key={i} position={[bx, by, -D / 2 + 0.235]}>
          <sphereGeometry args={[0.016, 10, 8]} />
          <meshStandardMaterial color="#9A876C" roughness={0.6} />
        </mesh>
      ))}

      {[-1, 1].map((side) => (
        <group key={side} position={[side * (W / 2 - 0.09), 0, 0]}>
          <mesh position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.19, 0.19, D, 20]} />
            {upholstery}
          </mesh>
          <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.19, 0.42, D]} />
            {upholstery}
          </mesh>
        </group>
      ))}

      {/* scatter cushions, propped against the back */}
      {[-0.62, 0.02, 0.66].map((cx, i) => (
        <mesh
          key={i}
          position={[cx, 0.67, -0.15]}
          rotation={[0.34, i === 1 ? 0.12 : -0.14, i * 0.08 - 0.08]}
          geometry={cushionGeometry(0.33, 0.33, 0.15, 0.5)}
          castShadow
        >
          <meshStandardMaterial
            map={velvet.map}
            normalMap={velvet.normalMap}
            color="#8E7A5E"
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
      ))}

      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (W / 2 - 0.14), 0.06, sz * (D / 2 - 0.14)]} castShadow>
          <cylinderGeometry args={[0.035, 0.05, 0.12, 12]} />
          <meshStandardMaterial map={legMaps.map} normalMap={legMaps.normalMap} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

interface Blade {
  angle: number
  lean: number
  height: number
  length: number
  width: number
  tone: string
  curl: number
}

function buildBlades(seed: number, count: number, spread: number): Blade[] {
  const out: Blade[] = []
  for (let i = 0; i < count; i += 1) {
    const r = hashString(`blade:${seed}:${i}`)
    const r2 = hashString(`blade2:${seed}:${i}`)
    // Three loose tiers, so the plant has an inner crown and outer skirt rather than one
    // flat starburst.
    const tier = i % 3
    out.push({
      angle: (i / count) * Math.PI * 2 * 2.7 + r * 0.9,
      lean: (0.16 + tier * 0.16 + r * 0.14) * spread,
      height: 0.2 + (2 - tier) * 0.11 + r2 * 0.12,
      length: 0.26 + r2 * 0.16,
      width: 0.09 + r * 0.05,
      tone: FOLIAGE_TONES[i % FOLIAGE_TONES.length],
      curl: 0.25 + r2 * 0.5,
    })
  }
  return out
}

/** The leaves themselves, shared by the potted plants and the floor trough. */
function Foliage({ seed, count = 30, spread = 1 }: { seed: number; count?: number; spread?: number }) {
  const blades = useMemo(() => buildBlades(seed, count, spread), [seed, count, spread])

  return (
    <group>
      {blades.map((b, i) => {
        const tilt = Math.atan2(b.lean, b.height)
        return (
          <group key={i} rotation={[0, -b.angle, 0]}>
            <group rotation={[0, 0, -tilt]}>
              {/* stem */}
              <mesh position={[0, b.height * 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.004, 0.006, b.height, 5]} />
                <meshStandardMaterial color="#3D5434" roughness={0.9} />
              </mesh>
              {/* leaf, arching over at its tip */}
              <mesh
                position={[0, b.height, 0]}
                rotation={[0, 0, b.curl]}
                scale={[b.width, b.length, 1]}
                geometry={LEAF_GEOMETRY}
                castShadow
              >
                <meshStandardMaterial
                  color={b.tone}
                  roughness={0.74}
                  metalness={0.02}
                  side={DoubleSide}
                />
              </mesh>
            </group>
          </group>
        )
      })}
    </group>
  )
}

/**
 * A potted plant: a glazed ceramic pot and a dense spray of pointed leaves in loose tiers.
 */
export function Plant({
  position,
  scale = 1,
  seed = 1,
  potColor = '#E2D6C0',
}: {
  position: [number, number, number]
  scale?: number
  seed?: number
  /** Cream glazed ceramic by default — terracotta added yet another brown to a brown room. */
  potColor?: string
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.32, 24]} />
        <meshStandardMaterial color={potColor} roughness={0.42} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.325, 0]} castShadow>
        <cylinderGeometry args={[0.215, 0.205, 0.05, 24]} />
        <meshStandardMaterial color={potColor} roughness={0.36} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.335, 0]}>
        <cylinderGeometry args={[0.185, 0.185, 0.02, 20]} />
        <meshStandardMaterial color="#33281F" roughness={1} />
      </mesh>

      <group position={[0, 0.35, 0]}>
        <Foliage seed={seed} count={34} spread={1} />
      </group>
    </group>
  )
}

/**
 * A lit planter recess set into the wall: a dark reveal, a row of low foliage and a concealed
 * strip washing down over it. Built as a shallow box standing slightly proud of the plaster
 * rather than a genuine hole — from every angle in the room it reads as a recess, and cutting
 * the wall would mean rebuilding it in pieces the way the window opening is.
 *
 * Being on the wall also keeps the floor clear, which is what stopped the couch feeling
 * jammed against it.
 */
export function PlanterNiche({
  position,
  width = 1.5,
  height = 0.45,
}: {
  position: [number, number, number]
  width?: number
  height?: number
}) {
  const depth = 0.24

  const clumps = useMemo(() => {
    const out: { x: number; scale: number; seed: number }[] = []
    const count = 6
    for (let i = 0; i < count; i += 1) {
      const r = hashString(`niche:${i}`)
      out.push({
        x: (i / (count - 1) - 0.5) * (width - 0.28),
        // Low mounding planting, sized to sit comfortably inside the recess rather than
        // filling it — but not so small it reads as moss.
        scale: 0.4 + r * 0.16,
        seed: 60 + i,
      })
    }
    return out
  }, [width])

  return (
    <group position={position}>
      {/* dark interior */}
      <mesh position={[0, 0, -depth / 2]} receiveShadow>
        <boxGeometry args={[width, height, 0.02]} />
        <meshStandardMaterial color="#4A4036" roughness={0.95} />
      </mesh>

      {/* reveals: head, sill and two jambs */}
      {(
        [
          { pos: [0, height / 2, 0], size: [width, 0.03, depth] },
          { pos: [0, -height / 2, 0], size: [width, 0.03, depth] },
          { pos: [-width / 2, 0, 0], size: [0.03, height, depth] },
          { pos: [width / 2, 0, 0], size: [0.03, height, depth] },
        ] as const
      ).map((piece, i) => (
        <mesh key={i} position={piece.pos as unknown as [number, number, number]} receiveShadow>
          <boxGeometry args={piece.size as unknown as [number, number, number]} />
          <meshStandardMaterial color="#EFE4D2" roughness={0.92} />
        </mesh>
      ))}

      {/* concealed strip along the head, washing down over the foliage */}
      <mesh position={[0, height / 2 - 0.035, 0.055]}>
        <boxGeometry args={[width - 0.1, 0.012, 0.014]} />
        <meshBasicMaterial color="#FFE8C0" toneMapped={false} />
      </mesh>
      {[-0.26, 0.26].map((offset) => (
        <pointLight
          key={offset}
          position={[width * offset, height / 2 - 0.09, 0.02]}
          color="#FFDFAE"
          intensity={0.6}
          distance={1.2}
          decay={2}
        />
      ))}

      {/* soil tray */}
      <mesh position={[0, -height / 2 + 0.04, -0.015]}>
        <boxGeometry args={[width - 0.08, 0.05, depth * 0.66]} />
        <meshStandardMaterial color="#33281F" roughness={1} />
      </mesh>

      {clumps.map((c, i) => (
        <group key={i} position={[c.x, -height / 2 + 0.065, -0.015]} scale={c.scale}>
          <Foliage seed={c.seed} count={16} spread={1.35} />
        </group>
      ))}
    </group>
  )
}
