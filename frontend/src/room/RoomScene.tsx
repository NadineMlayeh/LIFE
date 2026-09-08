import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { ACESFilmicToneMapping, MathUtils, Vector3 } from 'three'
import type { Book } from '../types'
import { Bookshelf } from './Bookshelf'
import { Couch, Plant, PlanterNiche } from './Furniture'
import { LongcaseClock } from './LongcaseClock'
import { Mirror } from './Mirror'
import { PhotoFrames } from './PhotoFrames'
import { WorldMap } from './WorldMap'
import { PALETTE } from './palette'
import { RoomShell } from './RoomShell'
import { lightingForDate, type DayLighting } from './timeOfDay'

export type FocusTarget =
  | 'overview'
  | 'bookshelf'
  | 'clock'
  | 'mirror'
  | 'map'
  | 'frames'
  | 'window'
  | 'switch'

interface Shot {
  position: Vector3
  target: Vector3
}

// The camera stands inside the room at roughly eye height, as though you had just walked in
// and stopped. Clicking an object walks you toward it. Never outside the walls — seeing the
// room's outer edges is what made it read as a box on a table.
const SHOTS: Record<FocusTarget, Shot> = {
  // The framing the owner picked: standing right of centre, far enough back that the window
  // still reads at the left edge and the corner clock at the right. Target height is close to
  // eye level so the view stays roughly horizontal — looking *down* is what filled earlier
  // attempts with empty floorboards.
  overview: { position: new Vector3(2.0, 1.62, 2.5), target: new Vector3(-0.5, 1.45, -2.9) },
  bookshelf: { position: new Vector3(-2.05, 1.5, -1.2), target: new Vector3(-2.1, 1.25, -3.2) },
  clock: { position: new Vector3(1.85, 1.5, -1.75), target: new Vector3(3.05, 1.35, -2.85) },
  mirror: { position: new Vector3(-1.75, 1.5, -2.05), target: new Vector3(-3.5, 1.35, -2.1) },
  map: { position: new Vector3(-0.2, 1.74, -1.7), target: new Vector3(-0.2, 1.8, -3.35) },
  frames: { position: new Vector3(1.55, 1.8, -1.6), target: new Vector3(1.55, 1.92, -3.36) },
  // The window is in the left-hand wall; stand back from it so both curtains are in shot.
  window: { position: new Vector3(-1.15, 1.6, 0.15), target: new Vector3(-3.6, 1.5, 0.15) },
  // The switch is a small thing, so this one goes closer than any other shot.
  switch: { position: new Vector3(1.95, 1.42, -2.35), target: new Vector3(2.42, 1.3, -3.36) },
}

function CameraRig({ focus, parallax }: { focus: FocusTarget; parallax: boolean }) {
  const { camera } = useThree()
  const target = useRef(SHOTS.overview.target.clone())
  const pointer = useRef({ x: 0, y: 0 })
  // Reused every frame — allocating a Vector3 sixty times a second is free garbage.
  const desired = useRef(new Vector3())

  useFrame((state, delta) => {
    const shot = SHOTS[focus]

    // Cursor parallax, kept tiny — the room should feel alive, not shaky (spec B.3).
    if (parallax) {
      pointer.current.x = MathUtils.lerp(pointer.current.x, state.pointer.x, 0.05)
      pointer.current.y = MathUtils.lerp(pointer.current.y, state.pointer.y, 0.05)
    }

    const offsetX = parallax ? pointer.current.x * 0.28 : 0
    const offsetY = parallax ? pointer.current.y * 0.18 : 0

    desired.current.set(shot.position.x + offsetX, shot.position.y + offsetY, shot.position.z)

    const k = 1 - Math.pow(0.0025, delta)
    camera.position.lerp(desired.current, k)
    target.current.lerp(shot.target, k)
    camera.lookAt(target.current)
  })

  return null
}

function Lighting({
  lighting,
  curtainOpen,
  lampOn,
}: {
  lighting: DayLighting
  curtainOpen: number
  lampOn: boolean
}) {
  // Drawn curtains genuinely darken the room; a little light still filters through the cloth.
  const daylight = 0.16 + curtainOpen * 0.84

  return (
    <>
      <ambientLight
        color={lighting.ambientColor}
        intensity={lighting.ambientIntensity * (0.55 + curtainOpen * 0.45)}
      />

      {/* The lamp's spill into the far corners. This light is ALWAYS mounted and merely dimmed
          to zero — mounting and unmounting it changed the scene's light count, which forces
          three.js to recompile every material's shader. That recompile was the freeze on
          flicking the switch. Never add or remove lights at runtime; only change intensity. */}
      <ambientLight color="#FFD2A0" intensity={lampOn ? 0.42 : 0} />

      {/* the sun, coming through the window on the left */}
      <directionalLight
        position={lighting.sunPosition}
        color={lighting.sunColor}
        intensity={lighting.sunIntensity * daylight}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={0.1}
        shadow-camera-far={26}
      />

      {/* warm bounce off the floor, so shadowed sides never go dead grey */}
      <hemisphereLight
        color={lighting.bounceColor}
        groundColor={PALETTE.floorDark}
        intensity={lighting.bounceIntensity * (0.5 + curtainOpen * 0.5)}
      />
    </>
  )
}

export function RoomScene({
  books,
  eventCount,
  visitedCountries,
  featuredPhotoUrl,
  focus,
  onFocus,
  onOpenLibrary,
  onOpenTimeline,
  onOpenMap,
  onOpenIdentity,
  onOpenGallery,
  onGoOutside,
  onHoverObject,
  paused = false,
}: {
  books: Book[]
  eventCount: number
  visitedCountries: { countryCode: string; status: string }[]
  featuredPhotoUrl: string | null
  focus: FocusTarget
  /** Stops the render loop while a document is open over the room. */
  paused?: boolean
  onFocus: (target: FocusTarget) => void
  onOpenLibrary: () => void
  onOpenTimeline: () => void
  onOpenMap: () => void
  onOpenIdentity: () => void
  onOpenGallery: () => void
  /** The window is the way out. The mailbox lives outside, where a mailbox belongs. */
  onGoOutside: () => void
  onHoverObject: (label: string | null) => void
}) {
  const lighting = useMemo(() => lightingForDate(), [])
  const [ready, setReady] = useState(false)
  const [curtainOpen, setCurtainOpen] = useState(1)
  // The lamp starts on when the daylight can't carry the room by itself.
  const [lampOn, setLampOn] = useState(
    () => lighting.phase === 'night' || lighting.phase === 'sunset',
  )

  return (
    <Canvas
      shadows
      /* The whole scene — pendulum, parallax, reflections — keeps rendering at 60fps behind an
         open document, and every keystroke then repaints a blurred backdrop over a live
         canvas. Freezing the loop is what makes typing feel immediate. */
      frameloop={paused ? 'never' : 'always'}
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.18 }}
      camera={{ position: SHOTS.overview.position.toArray(), fov: 54, near: 0.08, far: 60 }}
      onCreated={() => setReady(true)}
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 900ms ease' }}
    >
      <color attach="background" args={[lighting.skyBottom]} />

      <Lighting lighting={lighting} curtainOpen={curtainOpen} lampOn={lampOn} />

      {/* Reflections without downloading an HDR: lightformers rendered to a cubemap in
          engine, so the brass and glass have something real to catch. */}
      <Environment resolution={128}>
        <Lightformer
          intensity={lighting.phase === 'night' ? 0.4 : 2.2}
          color={lighting.sunColor}
          position={[-5, 2, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[3, 4, 1]}
        />
        <Lightformer
          intensity={0.7}
          color={lighting.bounceColor}
          position={[3, 1, 3]}
          rotation={[0, -Math.PI / 4, 0]}
          scale={[4, 3, 1]}
        />
        <Lightformer
          form="ring"
          intensity={0.5}
          color="#FFF2DC"
          position={[0, 4, 0]}
          scale={[6, 6, 1]}
        />
      </Environment>

      <CameraRig focus={focus} parallax={focus === 'overview'} />

      <RoomShell
        lighting={lighting}
        curtainOpen={curtainOpen}
        onCurtainChange={setCurtainOpen}
        lampOn={lampOn}
        onToggleLamp={() => setLampOn((v) => !v)}
        onGoOutside={onGoOutside}
        onHover={onHoverObject}
      />

      {/* Arranged to the owner's mockup: shelf left, map centre, framed photo over the couch,
          longcase clock in the right-hand corner. */}
      <Bookshelf
        books={books}
        position={[-2.1, 0, -3.2]}
        onOpenBook={onOpenLibrary}
        onOpenShelf={onOpenLibrary}
        onFocus={() => onFocus('bookshelf')}
        onHoverBook={onHoverObject}
      />

      {/* couch stops short of the clock's corner: its right arm reached x 2.82 and the clock
          base starts at 2.78 */}
      <Couch position={[1.55, 0, -2.82]} />

      {/* Wall recess, but dropped so its sill meets the floorboards — a planting bed set into
          the base of the wall rather than a box hung on it. */}
      <PlanterNiche position={[-0.2, 0.27, -3.28]} width={1.5} height={0.54} />
      {/* Both clear of the window: the first plant stood in front of the glass and blocked
          the room's only light source. */}
      <Plant position={[-2.95, 0, 2.1]} scale={0.85} seed={2} />
      {/* one either side of the bookshelf, so the left half of the wall reads as composed */}
      <Plant position={[-3.12, 0, -2.98]} scale={0.72} seed={4} />
      <Plant position={[-1.32, 0, -2.98]} scale={0.68} seed={7} />

      {/* right-hand corner, angled into the room */}
      <LongcaseClock
        position={[3.05, 0, -2.85]}
        rotation={[0, -0.42, 0]}
        eventCount={eventCount}
        onHover={onHoverObject}
        onOpen={() => {
          onFocus('clock')
          onOpenTimeline()
        }}
      />

      {/* Back wall, laid out left to right so nothing overlaps: mirror, clock, map, shelf.
          The map previously sat behind the bookshelf, and the mirror was on the right-hand
          wall which the camera never looks at. */}
      <WorldMap
        position={[-0.2, 1.8, -3.36]}
        visited={visitedCountries}
        onHover={onHoverObject}
        onOpen={() => {
          onFocus('map')
          onOpenMap()
        }}
      />

      {/* On the window wall beside the glass, where a pier glass belongs — it catches the
          daylight instead of competing with the clock for the back wall. */}
      <Mirror
        position={[-3.55, 1.35, -2.1]}
        rotation={[0, Math.PI / 2, 0]}
        onHover={onHoverObject}
        onOpen={() => {
          onFocus('mirror')
          onOpenIdentity()
        }}
      />

      {/* hung over the couch, with its own picture light */}
      <PhotoFrames
        position={[1.55, 1.92, -3.36]}
        featuredUrl={featuredPhotoUrl}
        onHover={onHoverObject}
        onOpen={() => {
          onFocus('frames')
          onOpenGallery()
        }}
      />

    </Canvas>
  )
}
