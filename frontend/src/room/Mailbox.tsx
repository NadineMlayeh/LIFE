import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import {
  DoubleSide,
  ExtrudeGeometry,
  Path,
  Shape,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from 'three'
import { createWoodMaps } from './textures'

/**
 * A curbside post box on a stand.
 *
 * The shape is the whole thing, and it is not a box: a post box is a **tunnel** — a flat floor,
 * straight sides, and a semicircular roof running the length of it. Approximating that with a
 * cube and a half-cylinder stuck on top leaves a seam where the two meet, and that seam is
 * most of what makes a model look like a toy. Here the silhouette is drawn once as a 2D
 * profile and extruded, so the curve and the sides are literally the same surface.
 *
 * What keeps it from reading as a plastic prop:
 *  - **Painted metal, not plastic.** Middling roughness with a little metalness, so the
 *    highlight is a soft band rather than a hard white dot.
 *  - **A deep, slightly greyed red.** Fully saturated primary red is the single strongest
 *    signal of a toy; real enamel is darker and duller than people expect.
 *  - **Every edge is broken.** Bevels on the extrusion, a rolled rim at the front, a seam
 *    where the door meets the body. Perfectly sharp corners are a modelling artefact.
 */

const WIDTH = 0.36
const STRAIGHT = 0.14
const DEPTH = 0.52
const RADIUS = WIDTH / 2

/** The tunnel section: flat floor, straight sides, semicircular roof. */
function tunnelProfile(inset = 0) {
  const w = WIDTH / 2 - inset
  const h = STRAIGHT - inset
  const shape = new Shape()
  shape.moveTo(-w, 0)
  shape.lineTo(-w, h)
  shape.absarc(0, h, w, Math.PI, 0, true)
  shape.lineTo(w, 0)
  shape.closePath()
  return shape
}

const WALL = 0.014

/**
 * The same profile with its middle cut out.
 *
 * `ExtrudeGeometry` caps both ends of whatever it extrudes, so a plain profile gives a solid
 * block — and a solid block has no inside. Opening the door on that revealed the front cap and
 * the whole box stayed one flat red, which is exactly what it looked like. Punching a hole in
 * the shape turns the extrusion into a **shell** with a real bore through it, and only then is
 * there anything for the door to open onto.
 */
function tunnelShell() {
  const shape = tunnelProfile()
  shape.holes.push(new Path().setFromPoints(tunnelProfile(WALL).getPoints(48)))
  return shape
}

/*
  The box's three shapes never vary, so they are built once for the session rather than once
  per mount. Extrusion is not free — each of these tessellates a curve at 32 segments — and the
  garden is unmounted every time you step back indoors.
*/
const geometryCache = new Map<string, ExtrudeGeometry>()

function cached(key: string, build: () => ExtrudeGeometry): ExtrudeGeometry {
  const found = geometryCache.get(key)
  if (found) return found
  const made = build()
  geometryCache.set(key, made)
  return made
}

export function Mailbox({
  position,
  rotation = [0, 0, 0],
  unread,
  onOpen,
  onHover,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  unread: number
  onOpen: () => void
  onHover: (label: string | null) => void
}) {
  const [hovered, setHovered] = useState(false)
  const door = useRef<Group>(null)
  const flag = useRef<Group>(null)
  const paint = useRef<Mesh>(null)

  const body = useMemo(
    () =>
      cached('body', () =>
        new ExtrudeGeometry(tunnelShell(), {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.006,
          bevelSegments: 3,
          curveSegments: 32,
        }),
      ),
    [],
  )

  // The door is the same profile a little smaller, so it sits *in* the opening rather than
  // over it — a flat plate on the front is the other giveaway of a quick model.
  const doorGeometry = useMemo(
    () =>
      cached('door', () =>
        new ExtrudeGeometry(tunnelProfile(0.012), {
        depth: 0.02,
        bevelEnabled: true,
        bevelThickness: 0.004,
        bevelSize: 0.004,
          bevelSegments: 2,
          curveSegments: 32,
        }),
      ),
    [],
  )

  const liner = useMemo(
    () =>
      cached('liner', () =>
        new ExtrudeGeometry(tunnelProfile(WALL + 0.001), {
          depth: DEPTH - 0.05,
          bevelEnabled: false,
          curveSegments: 32,
        }),
      ),
    [],
  )

  const postWood = useMemo(
    () =>
      createWoodMaps({
        seed: 37,
        light: '#8A6B4A',
        dark: '#5B4029',
        size: 256,
        repeat: 3,
        ringFrequency: 16,
        knots: 1,
      }),
    [],
  )

  useFrame(() => {
    // The door falls open when you reach for it, and the flag stands up while post is waiting.
    if (door.current) {
      const target = hovered ? -1.62 : 0
      door.current.rotation.x += (target - door.current.rotation.x) * 0.14
    }
    if (flag.current) {
      const target = unread > 0 ? 0 : -1.5
      flag.current.rotation.z += (target - flag.current.rotation.z) * 0.12
    }
    if (paint.current) {
      const material = paint.current.material as MeshStandardMaterial
      material.emissiveIntensity += ((hovered ? 0.14 : 0) - material.emissiveIntensity) * 0.15
    }
  })

  return (
    <group
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover(unread > 0 ? `The mailbox · ${unread} waiting` : 'The mailbox')
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
        document.body.style.cursor = 'auto'
        onOpen()
      }}
    >
      {/* The post. Squared timber, weathered, set slightly into the ground. */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.085, 1.0, 0.085]} />
        <meshStandardMaterial
          map={postWood.map}
          normalMap={postWood.normalMap}
          roughnessMap={postWood.roughnessMap}
          color="#7A5A3C"
          roughness={0.85}
        />
      </mesh>

      {/* The board the box is bolted to. */}
      <mesh position={[0, 0.985, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.03, DEPTH * 0.9]} />
        <meshStandardMaterial color="#6B4A2E" roughness={0.8} />
      </mesh>

      {/* The body, lying along its length. */}
      <group position={[0, 1.0, -DEPTH / 2]}>
        <mesh ref={paint} geometry={body} castShadow receiveShadow>
          <meshStandardMaterial
            color="#9E2F26"
            roughness={0.44}
            metalness={0.22}
            emissive="#9E2F26"
            emissiveIntensity={0}
          />
        </mesh>

        {/* The dark inside of the box, set back from the mouth so the opening reads as a
            depth rather than as a painted circle. */}
        <mesh geometry={liner} position={[0, 0, 0.012]}>
          <meshStandardMaterial color="#2A1A16" roughness={0.95} side={DoubleSide} />
        </mesh>

        {/* The back plate, closing the far end. */}
        <mesh geometry={doorGeometry} position={[0, 0, -0.016]} castShadow>
          <meshStandardMaterial color="#7E241D" roughness={0.5} metalness={0.2} />
        </mesh>

        {/* Letters waiting inside, leaning against the back. Only when there is post — the
            reference for this whole object is a box with envelopes spilling out of it. */}
        {unread > 0 && (
          <group position={[0, 0.035, DEPTH * 0.52]}>
            {[0, 1, 2].slice(0, Math.min(3, unread)).map((i) => (
              <mesh
                key={i}
                position={[(i - 1) * 0.016, i * 0.006, -i * 0.03]}
                rotation={[0.16, (i - 1) * 0.1, (i - 1) * 0.06]}
                castShadow
              >
                <boxGeometry args={[0.2, 0.13, 0.006]} />
                <meshStandardMaterial
                  color={i === 1 ? '#D8C79E' : '#EFE7D6'}
                  roughness={0.92}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* A rolled rim around the mouth — the lip a real box is pressed with. */}
        <mesh position={[0, STRAIGHT, DEPTH + 0.004]} rotation={[0, 0, 0]}>
          <torusGeometry args={[RADIUS + 0.004, 0.007, 8, 32, Math.PI]} />
          <meshStandardMaterial color="#8B2820" roughness={0.42} metalness={0.28} />
        </mesh>
        <mesh position={[-RADIUS - 0.004, STRAIGHT / 2, DEPTH + 0.004]}>
          <boxGeometry args={[0.014, STRAIGHT, 0.014]} />
          <meshStandardMaterial color="#8B2820" roughness={0.42} metalness={0.28} />
        </mesh>
        <mesh position={[RADIUS + 0.004, STRAIGHT / 2, DEPTH + 0.004]}>
          <boxGeometry args={[0.014, STRAIGHT, 0.014]} />
          <meshStandardMaterial color="#8B2820" roughness={0.42} metalness={0.28} />
        </mesh>

        {/* The hinged door, pivoting at the bottom of the mouth. */}
        <group ref={door} position={[0, 0, DEPTH + 0.006]}>
          <mesh geometry={doorGeometry} position={[0, 0, 0]} castShadow>
            <meshStandardMaterial color="#A43229" roughness={0.44} metalness={0.22} />
          </mesh>
          {/* The unpainted inside of the door. Red on red gave no reading of whether it was
              open; a pale face swinging down is unmistakable. */}
          <mesh geometry={doorGeometry} position={[0, 0, -0.002]} scale={[0.97, 0.97, 0.4]}>
            <meshStandardMaterial color="#C9C2B4" roughness={0.72} metalness={0.35} />
          </mesh>
          {/* the little knob you'd actually pull */}
          <mesh position={[0, STRAIGHT + RADIUS * 0.45, 0.026]}>
            <sphereGeometry args={[0.014, 16, 12]} />
            <meshStandardMaterial color="#C8C2BA" roughness={0.35} metalness={0.75} />
          </mesh>
        </group>

        {/* The flag, on its pivot at the side. Up means something is waiting. */}
        <group position={[RADIUS + 0.012, STRAIGHT * 0.55, DEPTH * 0.62]}>
          <mesh>
            <cylinderGeometry args={[0.008, 0.008, 0.016, 12]} />
            <meshStandardMaterial color="#C8C2BA" roughness={0.35} metalness={0.7} />
          </mesh>
          <group ref={flag} rotation={[0, 0, -1.5]}>
            <mesh position={[0, 0.11, 0]} castShadow>
              <boxGeometry args={[0.012, 0.22, 0.012]} />
              <meshStandardMaterial color="#A43229" roughness={0.5} metalness={0.15} />
            </mesh>
            <mesh position={[0.055, 0.2, 0]} castShadow>
              <boxGeometry args={[0.1, 0.075, 0.008]} />
              <meshStandardMaterial color="#A43229" roughness={0.5} metalness={0.15} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
