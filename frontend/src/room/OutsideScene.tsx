import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import {
  ACESFilmicToneMapping,
  BackSide,
  IcosahedronGeometry,
  MathUtils,
  Vector3,
  type BufferGeometry,
} from 'three'
import { Plant } from './Furniture'
import { Mailbox } from './Mailbox'
import { createGrassTexture, createGravelTexture, createSkyTexture } from './outsideTextures'
import { PALETTE } from './palette'
import { createPlasterMaps, createWoodMaps } from './textures'
import { lightingForDate, type DayLighting } from './timeOfDay'

/**
 * Outside: the path in front of the house, the gate, and the post box.
 *
 * A separate scene from the room, not a wider version of it — modelling both as one space
 * would mean carrying the room's geometry and lights around while standing in a garden, for a
 * view that never sees them.
 *
 * The first version of this looked like blocks, and the reasons are the same three the room
 * had to learn: **flat colours on big surfaces, box geometry for organic things, and no
 * variation between neighbours.** Grass and gravel are drawn textures now, hedges are noisy
 * masses rather than cuboids, and nothing that grows is the same size or colour as the thing
 * beside it.
 */

/**
 * Standing **inside** the gate, looking up the path at the house, with the post box near at
 * hand on the left.
 *
 * The first framing put the camera outside the gate, which left a pier barely half a metre in
 * front of the lens — a grey slab across half the picture. Nothing may stand between the
 * viewer and the subject: the boundary is behind you here, the way it would be if you had just
 * walked in.
 */
export type OutsideFocus = 'overview' | 'mailbox'

const SHOTS: Record<OutsideFocus, { position: Vector3; target: Vector3 }> = {
  overview: {
    position: new Vector3(1.75, 1.45, 1.95),
    target: new Vector3(-0.7, 0.95, -1.5),
  },
  // Close in on the box, since the tour's spotlight falls on the centre of the screen and
  // whatever is being described has to be there.
  mailbox: {
    position: new Vector3(0.45, 1.3, 1.9),
    target: new Vector3(-1.3, 1.1, 0.5),
  },
}

function CameraRig({ focus }: { focus: OutsideFocus }) {
  const { camera } = useThree()
  const pointer = useRef({ x: 0, y: 0 })
  const desired = useRef(new Vector3())
  const target = useRef(SHOTS.overview.target.clone())

  useFrame((state, delta) => {
    const shot = SHOTS[focus]

    pointer.current.x = MathUtils.lerp(pointer.current.x, state.pointer.x, 0.05)
    pointer.current.y = MathUtils.lerp(pointer.current.y, state.pointer.y, 0.05)

    desired.current.set(
      shot.position.x + pointer.current.x * 0.34,
      shot.position.y + pointer.current.y * 0.16,
      shot.position.z,
    )
    const k = 1 - Math.pow(0.0025, delta)
    camera.position.lerp(desired.current, k)
    // The look-at point eases too, or the view snaps round while the body drifts.
    target.current.lerp(shot.target, k)
    camera.lookAt(target.current)
  })

  return null
}

/** A dome rather than a backdrop, so the sky wraps the scene and the horizon curves away. */
function Sky({ lighting }: { lighting: DayLighting }) {
  const texture = useMemo(() => createSkyTexture(lighting), [lighting])

  return (
    <group>
      <mesh>
        <sphereGeometry args={[64, 32, 24]} />
        <meshBasicMaterial map={texture} side={BackSide} toneMapped={false} fog={false} />
      </mesh>

      {/* Sun or moon, low over the roofline. A disc with a halo — the halo is what stops it
          reading as a sticker. */}
      <group position={lighting.moon ? [14, 18, -30] : [-22, 15, -28]}>
        <mesh>
          <circleGeometry args={[lighting.moon ? 1.5 : 1.9, 48]} />
          <meshBasicMaterial
            color={lighting.moon ? '#EFEAD8' : lighting.sunColor}
            toneMapped={false}
            fog={false}
          />
        </mesh>
        <mesh position={[0, 0, -0.1]}>
          <circleGeometry args={[lighting.moon ? 5 : 7, 48]} />
          <meshBasicMaterial
            color={lighting.moon ? '#9FB0CE' : lighting.sunColor}
            transparent
            opacity={lighting.moon ? 0.16 : 0.24}
            toneMapped={false}
            fog={false}
          />
        </mesh>
      </group>
    </group>
  )
}

/**
 * A clipped hedge. Built from overlapping noisy blobs rather than a cuboid: a hedge is cut
 * flat on top but its surface is still thousands of leaves, so the silhouette has to be
 * slightly ragged or it reads as a painted crate.
 */
/*
  Cached across mounts, not just across renders.

  `useMemo` only holds a value while the component is alive, and stepping between the room and
  the garden unmounts this whole scene. Every trip outside was building a fresh set of hedge
  geometries and handing the old ones to the garbage collector — which does not free the GPU
  buffers behind them. A module-level cache means the garden is built once per session however
  many times you walk out of the door.
*/
const ballCache = new Map<string, BufferGeometry>()

function bumpyBall(radius: number, seed: number): BufferGeometry {
  const key = `${radius.toFixed(3)}:${seed}`
  const cached = ballCache.get(key)
  if (cached) return cached

  const geometry = new IcosahedronGeometry(radius, 3)
  const position = geometry.attributes.position
  let a = seed >>> 0
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const push = 1 + (rand() - 0.5) * 0.22
    // Flattened on top, as a hedge that has been cut is.
    position.setXYZ(i, x * push, Math.min(y * push, radius * 0.72), z * push)
  }
  geometry.computeVertexNormals()
  ballCache.set(key, geometry)
  return geometry
}

function Hedge({
  position,
  length,
  seed,
}: {
  position: [number, number, number]
  length: number
  seed: number
}) {
  const blobs = useMemo(() => {
    const count = Math.max(2, Math.round(length / 0.62))
    return Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1)
      const r = 0.44 + ((seed * (i + 3)) % 7) * 0.018
      return {
        geometry: bumpyBall(r, seed * 31 + i * 7),
        x: (t - 0.5) * length,
        y: 0.4 + (((seed + i) % 5) - 2) * 0.012,
        z: (((seed * (i + 1)) % 5) - 2) * 0.03,
        // No two neighbours the same green, or the whole run flattens into one shape.
        tint: ['#3D5133', '#44593A', '#374A2E', '#405436'][(seed + i) % 4],
      }
    })
  }, [length, seed])

  return (
    <group position={position}>
      {blobs.map((blob, i) => (
        <mesh
          key={i}
          geometry={blob.geometry}
          position={[blob.x, blob.y, blob.z]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={blob.tint} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** The front of the house you have just stepped out of, with your own window lit. */
function Facade({ lampOn }: { lampOn: boolean }) {
  const render = useMemo(
    () => createPlasterMaps({ seed: 12, color: '#C4AC8C', size: 512, repeat: 5 }),
    [],
  )
  const trim = useMemo(
    () =>
      createWoodMaps({
        seed: 55,
        light: '#7A5233',
        dark: '#4E331E',
        size: 256,
        repeat: 2,
        ringFrequency: 14,
        knots: 0,
      }),
    [],
  )

  return (
    <group position={[0, 0, -3.4]}>
      <mesh position={[0, 2.7, 0]} receiveShadow castShadow>
        <boxGeometry args={[10, 5.4, 0.4]} />
        <meshStandardMaterial
          map={render.map}
          normalMap={render.normalMap}
          roughnessMap={render.roughnessMap}
          color="#BCA488"
          roughness={0.96}
        />
      </mesh>

      {/* Stone plinth along the base, where render would be worn by rain. */}
      <mesh position={[0, 0.3, 0.07]} receiveShadow castShadow>
        <boxGeometry args={[10, 0.6, 0.54]} />
        <meshStandardMaterial color="#8C7F70" roughness={0.98} />
      </mesh>

      {/* Your window, warm when the lamp is on inside. */}
      <group position={[-1.7, 2.0, 0.22]}>
        <mesh castShadow>
          <boxGeometry args={[1.3, 1.8, 0.1]} />
          <meshStandardMaterial
            map={trim.map}
            normalMap={trim.normalMap}
            color="#6E4A2E"
            roughness={0.72}
          />
        </mesh>
        <mesh position={[0, 0, 0.055]}>
          <planeGeometry args={[1.08, 1.58]} />
          <meshStandardMaterial
            color={lampOn ? '#F6D090' : '#39434A'}
            emissive={lampOn ? '#E9A94C' : '#0A0C0E'}
            emissiveIntensity={lampOn ? 1.1 : 0}
            roughness={0.24}
            metalness={0.1}
          />
        </mesh>
        {[-0.27, 0.27].map((x) => (
          <mesh key={x} position={[x, 0, 0.065]}>
            <boxGeometry args={[0.026, 1.58, 0.02]} />
            <meshStandardMaterial color="#6E4A2E" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.065]}>
          <boxGeometry args={[1.08, 0.026, 0.02]} />
          <meshStandardMaterial color="#6E4A2E" roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.95, 0.09]} castShadow>
          <boxGeometry args={[1.5, 0.08, 0.22]} />
          <meshStandardMaterial color="#8C7F70" roughness={0.9} />
        </mesh>
      </group>

      {/* The door back in, with a step and a lantern beside it. */}
      <group position={[1.5, 0, 0.22]}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[1.06, 2.4, 0.1]} />
          <meshStandardMaterial
            map={trim.map}
            normalMap={trim.normalMap}
            color="#5A3A22"
            roughness={0.66}
          />
        </mesh>
        {[0.5, -0.32].map((y) => (
          <mesh key={y} position={[0, 1.2 + y, 0.056]}>
            <boxGeometry args={[0.68, 0.74, 0.02]} />
            <meshStandardMaterial color="#4A2F1D" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0.36, 1.16, 0.085]}>
          <sphereGeometry args={[0.046, 16, 12]} />
          <meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={0.85} />
        </mesh>
        {/* the step */}
        <mesh position={[0, 0.07, 0.28]} receiveShadow castShadow>
          <boxGeometry args={[1.5, 0.14, 0.6]} />
          <meshStandardMaterial color="#8C7F70" roughness={0.97} />
        </mesh>
        {/* porch lantern */}
        <group position={[0.8, 2.2, 0.16]}>
          <mesh>
            <boxGeometry args={[0.14, 0.2, 0.14]} />
            <meshStandardMaterial
              color="#3A3128"
              roughness={0.5}
              metalness={0.5}
              emissive={lampOn ? '#FFCE84' : '#000000'}
              emissiveIntensity={lampOn ? 0.9 : 0}
            />
          </mesh>
          {lampOn && <pointLight color="#FFCE84" intensity={2.2} distance={4.5} decay={2} />}
        </group>
      </group>
    </group>
  )
}

function Garden() {
  return (
    <group>
      <Hedge position={[-2.9, 0, -0.4]} length={3.1} seed={5} />
      <Hedge position={[3.0, 0, -0.5]} length={3.0} seed={11} />
      <Hedge position={[-2.4, 0, 1.9]} length={1.7} seed={17} />
      <Hedge position={[2.6, 0, 1.6]} length={1.5} seed={23} />
      <Hedge position={[-1.9, 0, -2.5]} length={1.9} seed={29} />

      {/* Gate piers where the street begins. */}
      {[-1.5, 1.5].map((x) => (
        <group key={x} position={[x, 0, 2.9]}>
          <mesh position={[0, 0.54, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.24, 1.08, 0.24]} />
            <meshStandardMaterial color="#8C7F70" roughness={0.97} />
          </mesh>
          <mesh position={[0, 1.13, 0]} castShadow>
            <boxGeometry args={[0.32, 0.1, 0.32]} />
            <meshStandardMaterial color="#7C7062" roughness={0.97} />
          </mesh>
        </group>
      ))}

      {/* Railings between the piers — the edge of the world, for now. */}
      {Array.from({ length: 8 }, (_, i) => -1.28 + i * 0.365).map((x) => (
        <mesh key={x} position={[x, 0.4, 2.9]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 0.88, 8]} />
          <meshStandardMaterial color="#2A2724" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.78, 2.9]} castShadow>
        <boxGeometry args={[2.72, 0.035, 0.035]} />
        <meshStandardMaterial color="#2A2724" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Planting along the wall and the path, reusing the room's plants so the two worlds are
          made of the same stuff. Different sizes and seeds — a row of identical shrubs is the
          same mistake as a row of identical fold. */}
      {/* Two pots either side of the step, which is the one place outdoors a potted plant
          belongs. Standing in open lawn they read as houseplants someone forgot. */}
      <Plant position={[0.55, 0, -2.9]} scale={0.72} seed={3} />
      <Plant position={[2.45, 0, -2.9]} scale={0.62} seed={14} />
    </group>
  )
}

function Ground() {
  const grass = useMemo(() => createGrassTexture(), [])
  const gravel = useMemo(() => createGravelTexture(), [])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial map={grass} color="#8C9C72" roughness={1} />
      </mesh>

      {/* The path from the door to the gate, sunk a hair so its edge catches a shadow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0.6]} receiveShadow>
        <planeGeometry args={[1.7, 6.4]} />
        <meshStandardMaterial map={gravel} color="#B5AC98" roughness={0.98} />
      </mesh>
    </group>
  )
}

function Lighting({ lighting }: { lighting: DayLighting }) {
  const night = lighting.phase === 'night'

  return (
    <>
      {/*
        Night outdoors needs far more light than night indoors. Inside, the lamp carries the
        room; out here the only sources are the moon and a porch lantern, and the ground and
        hedges are dark to begin with — so the same values that read as evening inside read as
        a black screen out here. Lifted until the garden is legible while still plainly night.
      */}
      <ambientLight
        color={lighting.ambientColor}
        intensity={lighting.ambientIntensity * (night ? 1.95 : 1.45)}
      />
      <directionalLight
        position={night ? [12, 14, -8] : [-9, 7, 4]}
        color={night ? '#9FB4D8' : lighting.sunColor}
        intensity={night ? 1.15 : lighting.sunIntensity * 1.25}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-far={50}
      />
      {/* Sky above, ground bounce below — outdoors this does more than any fill light. */}
      <hemisphereLight
        color={lighting.skyTop}
        groundColor="#54603E"
        intensity={night ? 0.95 : lighting.bounceIntensity * 1.6}
      />
    </>
  )
}

export function OutsideScene({
  unreadLetters,
  onOpenMailbox,
  onGoInside,
  onHoverObject,
  focus = 'overview',
  paused = false,
}: {
  unreadLetters: number
  onOpenMailbox: () => void
  onGoInside: () => void
  onHoverObject: (label: string | null) => void
  /** The tour points this at the post box; everything else stands back. */
  focus?: OutsideFocus
  paused?: boolean
}) {
  const lighting = useMemo(() => lightingForDate(), [])
  const [ready, setReady] = useState(false)
  const night = lighting.phase === 'night'
  // The lamp inside is on whenever it would be inside, so the window agrees with the room.
  const lampOn = night || lighting.phase === 'sunset'

  return (
    <Canvas
      shadows
      frameloop={paused ? 'never' : 'always'}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: night ? 1.5 : 1.06,
      }}
      camera={{ position: SHOTS.overview.position.toArray(), fov: 50, near: 0.1, far: 200 }}
      onCreated={() => setReady(true)}
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 900ms ease' }}
    >
      {/* Fog tinted to the horizon, so distance fades into the sky rather than into grey. */}
      <fog attach="fog" args={[lighting.skyBottom, 16, 62]} />

      <CameraRig focus={focus} />
      <Lighting lighting={lighting} />
      <Sky lighting={lighting} />

      <Environment resolution={128}>
        <Lightformer
          intensity={night ? 0.5 : 1.8}
          color={lighting.skyTop}
          position={[0, 10, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[16, 16, 1]}
        />
        <Lightformer
          intensity={night ? 0.3 : 0.7}
          color={lighting.bounceColor}
          position={[0, -4, 6]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[16, 16, 1]}
        />
      </Environment>

      <Ground />
      <Garden />

      <group
        onPointerOver={(e) => {
          e.stopPropagation()
          onHoverObject('Back inside')
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          onHoverObject(null)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'auto'
          onGoInside()
        }}
      >
        <Facade lampOn={lampOn} />
      </group>

      <Mailbox
        position={[-1.3, 0, 0.5]}
        rotation={[0, 0.6, 0]}
        unread={unreadLetters}
        onOpen={onOpenMailbox}
        onHover={onHoverObject}
      />
    </Canvas>
  )
}
