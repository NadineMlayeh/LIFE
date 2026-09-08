import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BackSide, CanvasTexture, PlaneGeometry, SRGBColorSpace } from 'three'
import { PALETTE } from './palette'
import {
  createPaintedMaps,
  createPlankMaps,
  createPlasterMaps,
  createValanceTexture,
  createVelvetMaps,
  createWoodMaps,
} from './textures'
import type { DayLighting } from './timeOfDay'

// A real room you stand inside, not an open-sided diorama. The camera lives within these
// bounds, so all four walls and the ceiling exist and the outside is never visible.
const ROOM_WIDTH = 7.2
const ROOM_DEPTH = 6.8
const WALL_HEIGHT = 2.95

const HALF_W = ROOM_WIDTH / 2
const HALF_D = ROOM_DEPTH / 2

// The window is a genuine hole in the left wall, not a picture hung on it. Without this the
// wall blocks the sun and the room gets no daylight at all.
const WIN = {
  width: 1.75,
  height: 2.0,
  centerY: 1.55,
  centerZ: 0.15,
}
const WIN_Z0 = WIN.centerZ - WIN.width / 2
const WIN_Z1 = WIN.centerZ + WIN.width / 2
const WIN_Y0 = WIN.centerY - WIN.height / 2
const WIN_Y1 = WIN.centerY + WIN.height / 2

/** The view through the glass: a soft gradient, no scenery to date the room. */
function useSkyTexture(lighting: DayLighting) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, lighting.skyTop)
    gradient.addColorStop(0.75, lighting.skyBottom)
    gradient.addColorStop(1, lighting.bounceColor)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (lighting.moon) {
      ctx.globalAlpha = 0.9
      ctx.fillStyle = '#EAF0FA'
      ctx.beginPath()
      ctx.arc(canvas.width * 0.66, canvas.height * 0.2, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }, [lighting.skyTop, lighting.skyBottom, lighting.bounceColor, lighting.moon])
}

export function RoomShell({
  lighting,
  curtainOpen,
  onCurtainChange,
  lampOn,
  onToggleLamp,
  onGoOutside,
  onHover,
}: {
  lighting: DayLighting
  /** 0 = drawn across the window, 1 = pushed fully to the sides. */
  curtainOpen: number
  onCurtainChange: (value: number) => void
  lampOn: boolean
  onToggleLamp: () => void
  onGoOutside: () => void
  onHover: (label: string | null) => void
}) {
  const floorMaps = useMemo(
    () =>
      createPlankMaps({
        seed: 12,
        light: '#C6A074',
        dark: '#94683E',
        size: 1024,
        repeat: 2,
        boards: 8,
      }),
    [],
  )

  const wallMaps = useMemo(
    () => createPlasterMaps({ seed: 44, color: PALETTE.wall, size: 512, repeat: 3 }),
    [],
  )

  const ceilingMaps = useMemo(
    () => createPlasterMaps({ seed: 61, color: '#F7EFE2', size: 512, repeat: 3 }),
    [],
  )

  const paintedMaps = useMemo(
    () => createPaintedMaps({ seed: 17, color: '#F0E6D5', size: 256, repeat: 2 }),
    [],
  )

  const sky = useSkyTexture(lighting)

  const wallMaterial = (
    <meshStandardMaterial
      map={wallMaps.map}
      normalMap={wallMaps.normalMap}
      roughnessMap={wallMaps.roughnessMap}
      roughness={0.96}
      metalness={0}
      normalScale={[0.3, 0.3]}
    />
  )

  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial
          map={floorMaps.map}
          normalMap={floorMaps.normalMap}
          roughnessMap={floorMaps.roughnessMap}
          roughness={0.55}
          metalness={0}
          normalScale={[0.7, 0.7]}
        />
      </mesh>

      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial
          map={ceilingMaps.map}
          normalMap={ceilingMaps.normalMap}
          roughness={1}
          metalness={0}
          normalScale={[0.2, 0.2]}
        />
      </mesh>

      {/* back wall */}
      <mesh position={[0, WALL_HEIGHT / 2, -HALF_D]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, WALL_HEIGHT]} />
        {wallMaterial}
      </mesh>

      {/* Left wall in four solid pieces around the opening. Built as boxes in world space
          rather than rotated planes — the axis mapping under rotation is easy to get subtly
          wrong, and the thickness gives the window a real reveal. */}
      {(
        [
          { pos: [-HALF_W - 0.03, WIN_Y0 / 2, 0], size: [0.06, WIN_Y0, ROOM_DEPTH] },
          {
            pos: [-HALF_W - 0.03, (WIN_Y1 + WALL_HEIGHT) / 2, 0],
            size: [0.06, WALL_HEIGHT - WIN_Y1, ROOM_DEPTH],
          },
          {
            pos: [-HALF_W - 0.03, WIN.centerY, (-HALF_D + WIN_Z0) / 2],
            size: [0.06, WIN.height, WIN_Z0 + HALF_D],
          },
          {
            pos: [-HALF_W - 0.03, WIN.centerY, (WIN_Z1 + HALF_D) / 2],
            size: [0.06, WIN.height, HALF_D - WIN_Z1],
          },
        ] as const
      ).map((piece, i) => (
        <mesh key={i} position={piece.pos as unknown as [number, number, number]} receiveShadow castShadow>
          <boxGeometry args={piece.size as unknown as [number, number, number]} />
          {wallMaterial}
        </mesh>
      ))}

      {/* right wall */}
      <mesh position={[HALF_W, WALL_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_DEPTH, WALL_HEIGHT]} />
        {wallMaterial}
      </mesh>

      {/* wall behind the viewer — closes the box so no edge is ever visible */}
      <mesh position={[0, WALL_HEIGHT / 2, HALF_D]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, WALL_HEIGHT]} />
        {wallMaterial}
      </mesh>

      <CeilingBeams />
      <Skirting maps={paintedMaps} />
      <Wainscot maps={paintedMaps} />
      <Window
        lighting={lighting}
        sky={sky}
        curtainOpen={curtainOpen}
        onCurtainChange={onCurtainChange}
        onGoOutside={onGoOutside}
        onHover={onHover}
      />
      <PendantLamp on={lampOn} />
      <LightSwitch on={lampOn} onToggle={onToggleLamp} />
    </group>
  )
}

/**
 * Brass switch plate working the pendant. Sits right of the couch, in clear view — on the far
 * left of the wall it fell behind the bookshelf from the room's default angle.
 */
function LightSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <group
      position={[2.42, 1.3, -3.36]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[0.1, 0.14, 0.018]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.32}
          metalness={0.88}
          emissive={PALETTE.brass}
          emissiveIntensity={hovered ? 0.35 : 0.06}
        />
      </mesh>
      {/* the rocker, tilting with its state */}
      <mesh position={[0, on ? 0.016 : -0.016, 0.014]} rotation={[on ? -0.3 : 0.3, 0, 0]}>
        <boxGeometry args={[0.05, 0.055, 0.014]} />
        <meshStandardMaterial color="#F2E8D8" roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Dark beams across the ceiling. Cheap geometry, and they do a lot for the room's character. */
function CeilingBeams() {
  const maps = useMemo(
    () =>
      createWoodMaps({
        seed: 91,
        light: '#6B4A30',
        dark: '#4A3120',
        size: 256,
        repeat: 2,
        ringFrequency: 7,
        knots: 1,
      }),
    [],
  )

  const beams = [-2.1, -0.7, 0.7, 2.1]

  return (
    <group>
      {beams.map((z) => (
        <mesh key={z} position={[0, WALL_HEIGHT - 0.09, z]} castShadow receiveShadow>
          <boxGeometry args={[ROOM_WIDTH, 0.18, 0.22]} />
          <meshStandardMaterial
            map={maps.map}
            normalMap={maps.normalMap}
            roughnessMap={maps.roughnessMap}
            roughness={0.7}
          />
        </mesh>
      ))}
      {/* cornice where wall meets ceiling */}
      <mesh position={[0, WALL_HEIGHT - 0.05, -HALF_D + 0.06]} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, 0.1, 0.12]} />
        <meshStandardMaterial map={maps.map} normalMap={maps.normalMap} roughness={0.7} />
      </mesh>
    </group>
  )
}

/** Panelling below the window, as in the reference — architecture carrying the warmth. */
function Wainscot({ maps }: { maps: ReturnType<typeof createPaintedMaps> }) {
  const H = 0.85
  const material = (
    <meshStandardMaterial
      map={maps.map}
      normalMap={maps.normalMap}
      roughnessMap={maps.roughnessMap}
      roughness={0.45}
      metalness={0}
    />
  )

  return (
    <group>
      {/* rail along the back wall */}
      <mesh position={[0, H, -HALF_D + 0.04]} castShadow receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, 0.05, 0.08]} />
        {material}
      </mesh>
      <mesh position={[0, H / 2, -HALF_D + 0.02]} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, H, 0.04]} />
        {material}
      </mesh>

      {/* and along the right wall */}
      <mesh position={[HALF_W - 0.04, H, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.05, ROOM_DEPTH]} />
        {material}
      </mesh>
      <mesh position={[HALF_W - 0.02, H / 2, 0]} receiveShadow>
        <boxGeometry args={[0.04, H, ROOM_DEPTH]} />
        {material}
      </mesh>
    </group>
  )
}

/**
 * Brass pendant over the room. It carries its own light, which is what keeps the space warm
 * after the sun has gone and gives the ceiling something to catch.
 */
function PendantLamp({ on }: { on: boolean }) {
  // Strong enough that flicking the switch visibly transforms a dark room, which is the
  // whole point of having a switch.
  const intensity = on ? 3.2 : 0

  return (
    <group position={[0.15, 0, 0.1]}>
      {/* flex — kept short so the lamp sits high and stays out of the way */}
      <mesh position={[0, WALL_HEIGHT - 0.17, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.34, 8]} />
        <meshStandardMaterial color="#3A2A1E" roughness={0.8} />
      </mesh>

      {/* ceiling rose */}
      <mesh position={[0, WALL_HEIGHT - 0.015, 0]}>
        <cylinderGeometry args={[0.042, 0.05, 0.03, 20]} />
        <meshStandardMaterial color={PALETTE.brass} roughness={0.35} metalness={0.85} />
      </mesh>

      {/* dome shade */}
      <mesh position={[0, WALL_HEIGHT - 0.34, 0]} castShadow>
        <sphereGeometry args={[0.155, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.28}
          metalness={0.9}
          side={2}
        />
      </mesh>

      {/* the glowing underside */}
      <mesh position={[0, WALL_HEIGHT - 0.356, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.145, 32]} />
        <meshBasicMaterial color={on ? '#FFE6B8' : '#C8B79A'} toneMapped={false} />
      </mesh>

      <pointLight
        position={[0, WALL_HEIGHT - 0.42, 0]}
        color="#FFD9A0"
        intensity={intensity}
        distance={11}
        decay={1.7}
      />
    </group>
  )
}

function Skirting({ maps }: { maps: ReturnType<typeof createPaintedMaps> }) {
  const material = (
    <meshStandardMaterial
      map={maps.map}
      normalMap={maps.normalMap}
      roughnessMap={maps.roughnessMap}
      roughness={0.45}
      metalness={0}
    />
  )

  const H = 0.14

  return (
    <group>
      <mesh position={[0, H / 2, -HALF_D + 0.025]} castShadow receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, H, 0.05]} />
        {material}
      </mesh>
      <mesh position={[-HALF_W + 0.025, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.05, H, ROOM_DEPTH]} />
        {material}
      </mesh>
      <mesh position={[HALF_W - 0.025, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.05, H, ROOM_DEPTH]} />
        {material}
      </mesh>
    </group>
  )
}

/**
 * Tall, slim, painted. The previous frame was dark heavy timber in chunky proportions, which
 * read as a derelict cottage — this is the same window kept and looked after.
 */
function Window({
  lighting,
  sky,
  curtainOpen,
  onCurtainChange,
  onGoOutside,
  onHover,
}: {
  lighting: DayLighting
  sky: CanvasTexture
  curtainOpen: number
  onCurtainChange: (value: number) => void
  onGoOutside: () => void
  onHover: (label: string | null) => void
}) {
  const paintMaps = useMemo(
    () => createPaintedMaps({ seed: 29, color: '#F6EEE0', size: 256, repeat: 1 }),
    [],
  )

  const sillMaps = useMemo(
    () => createPaintedMaps({ seed: 31, color: '#F2E8D8', size: 256, repeat: 1 }),
    [],
  )

  const valance = useMemo(() => createValanceTexture(), [])

  // Matched to the hole in the wall, so the joinery always lines up with the opening.
  const W = WIN.width
  const H = WIN.height
  const bar = 0.035

  const paint = (
    <meshStandardMaterial
      map={paintMaps.map}
      normalMap={paintMaps.normalMap}
      roughnessMap={paintMaps.roughnessMap}
      roughness={0.42}
      metalness={0}
    />
  )

  return (
    <group position={[-HALF_W + 0.02, WIN.centerY, WIN.centerZ]} rotation={[0, Math.PI / 2, 0]}>
      {/* The daylight itself, and the way out. Clicking the glass takes you outside — the
          window has always been the room's one view of anywhere else, so it is the door. */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover('Step outside')
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          onHover(null)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'auto'
          onGoOutside()
        }}
      >
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>

      {/* glass sheen */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[W, H]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.07}
          roughness={0.03}
          metalness={0.05}
        />
      </mesh>

      {/* slim glazing bars: two tall panes over two, not a heavy cottage grid */}
      <mesh position={[0, 0, 0.022]}>
        <boxGeometry args={[bar, H, 0.03]} />
        {paint}
      </mesh>
      <mesh position={[0, H * 0.18, 0.022]}>
        <boxGeometry args={[W, bar, 0.03]} />
        {paint}
      </mesh>

      {/* outer casing, kept narrow */}
      {[
        { pos: [0, H / 2 + 0.05, 0.02], size: [W + 0.2, 0.1, 0.1] },
        { pos: [0, -H / 2 - 0.05, 0.02], size: [W + 0.2, 0.1, 0.1] },
        { pos: [-W / 2 - 0.05, 0, 0.02], size: [0.1, H + 0.2, 0.1] },
        { pos: [W / 2 + 0.05, 0, 0.02], size: [0.1, H + 0.2, 0.1] },
      ].map((piece, i) => (
        <mesh key={i} position={piece.pos as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={piece.size as [number, number, number]} />
          {paint}
        </mesh>
      ))}

      {/* sill with a slim moulding beneath */}
      <mesh position={[0, -H / 2 - 0.13, 0.09]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.34, 0.06, 0.24]} />
        <meshStandardMaterial
          map={sillMaps.map}
          normalMap={sillMaps.normalMap}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, -H / 2 - 0.2, 0.05]} castShadow>
        <boxGeometry args={[W + 0.24, 0.07, 0.12]} />
        {paint}
      </mesh>

      <Curtains width={W} height={H} open={curtainOpen} onChange={onCurtainChange} />

      {/* carved cornice board above the valance */}
      <mesh position={[0, H / 2 + 0.44, 0.24]} castShadow>
        <boxGeometry args={[W + 1.06, 0.13, 0.2]} />
        <meshStandardMaterial color="#5E3E22" roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[0, H / 2 + 0.52, 0.25]}>
        <boxGeometry args={[W + 1.14, 0.045, 0.22]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.32}
          metalness={0.88}
          emissive={PALETTE.brass}
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* the scalloped, fringed valance — alpha-shaped, so one plane carries all the detail */}
      <mesh position={[0, H / 2 + 0.19, 0.235]}>
        <planeGeometry args={[W + 1.02, 0.62]} />
        <meshStandardMaterial
          map={valance}
          transparent
          alphaTest={0.05}
          roughness={0.86}
          metalness={0.08}
          side={2}
        />
      </mesh>

      {/* curtain pole behind the valance */}
      <mesh position={[0, H / 2 + 0.24, 0.19]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.016, 0.016, W + 0.94, 12]} />
        <meshStandardMaterial color={PALETTE.brass} roughness={0.35} metalness={0.85} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (W / 2 + 0.47), H / 2 + 0.24, 0.19]}>
          <sphereGeometry args={[0.034, 16, 12]} />
          <meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={0.9} />
        </mesh>
      ))}

      {/* light spilling back off the reveal */}
      <pointLight
        position={[0, 0, 0.7]}
        color={lighting.sunColor}
        intensity={lighting.phase === 'night' ? 0.2 : 0.55}
        distance={4.5}
        decay={2}
      />
    </group>
  )
}

/**
 * Drapes held by a tieback are wide at the head, pinched at the tie and flaring to the floor.
 * A flat rectangle can never read as gathered fabric, so each pleat gets its own geometry with
 * that hourglass profile, deepening as the curtain is drawn back.
 *
 * Cached per (width, height, pinch) rounded to coarse steps: `pinch` changes continuously
 * while dragging, and building a fresh geometry every frame would be wasteful.
 */
const curtainPanelCache = new Map<string, PlaneGeometry>()

function curtainPanel(width: number, height: number, pinch: number): PlaneGeometry {
  const step = Math.round(pinch * 6) / 6
  const key = `${width.toFixed(3)}:${height.toFixed(3)}:${step}`
  const hit = curtainPanelCache.get(key)
  if (hit) return hit

  const FOLDS = 5
  const geometry = new PlaneGeometry(width, height, 40, 22)
  const pos = geometry.attributes.position

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const u = x / width + 0.5
    const v = y / height + 0.5

    // Waist just below the middle, where a tieback gathers the cloth; flaring to the hem.
    const waist = Math.exp(-Math.pow((v - 0.46) / 0.19, 2))
    const flare = Math.pow(Math.max(0, 0.5 - v) * 2, 2)
    const squeeze = 1 - step * (0.42 * waist - 0.2 * flare)

    // Folds are corrugations in depth, not separate strips. This is the fix for the gaps:
    // one continuous sheet can never open a hole between panels the way seven planes did.
    // Gathered cloth folds deeper, which is what gives an open curtain its weight.
    const fold = Math.sin(u * Math.PI * FOLDS * 2) * (0.045 + step * 0.055)
    const taperEdges = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI)

    pos.setX(i, x * squeeze)
    pos.setZ(i, fold * taperEdges + step * flare * 0.05)
  }

  pos.needsUpdate = true
  geometry.computeVertexNormals()
  curtainPanelCache.set(key, geometry)
  return geometry
}

/**
 * Each curtain is a run of narrow overlapping panels at alternating angles and depths. Flat
 * planes read as paper; folds are what make fabric look like fabric, and this is far cheaper
 * than real cloth geometry.
 */
function Curtains({
  width,
  height,
  open,
  onChange,
}: {
  width: number
  height: number
  open: number
  onChange: (value: number) => void
}) {
  const drag = useRef<{ x: number; open: number; side: number } | null>(null)
  const velvet = useMemo(() => createVelvetMaps({ seed: 55, size: 512, repeat: 1 }), [])
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // The drag has to be tracked on the window, not the mesh: a curtain panel is narrow, so the
  // pointer leaves it on the first few pixels of movement and mesh-level move events stop
  // firing immediately. That is why dragging appeared to do nothing at all.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return
      const dx = ((e.clientX - drag.current.x) / 240) * drag.current.side
      onChangeRef.current(Math.max(0, Math.min(1, drag.current.open + dx)))
    }
    const up = () => {
      if (!drag.current) return
      drag.current = null
      document.body.style.cursor = 'auto'
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  // Dragging a curtain toward the middle of the window closes it, away from it opens it —
  // which side you grabbed decides the sign.
  const onDown = (side: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    drag.current = { x: e.clientX, open, side }
    document.body.style.cursor = 'ew-resize'
  }

  // A plain click with no drag toggles, so the curtains respond to the obvious gesture too.
  const onClick = (side: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (Math.abs(e.movementX) > 2) return
    onChange(open > 0.5 ? 0 : 1)
    void side
  }

  // One continuous drape per side. Seven separate strips opened gaps the moment they were
  // pinched, and the pale sheer behind showed through as a band.
  // Generously wide, so a gathered curtain still reads as heavy cloth rather than a strip.
  const panelWidth = width / 2 + 0.34

  return (
    <group>
      {[-1, 1].map((side) => {
        // Gathering compresses the panel, but only so far — squeezing it to a third of its
        // width was what made the open curtains look thin and papery.
        const squeeze = 1 - open * 0.4
        const closedCentre = side * (width / 4 + 0.02)
        const openCentre = side * (width / 2 + 0.2)
        const x = closedCentre + (openCentre - closedCentre) * open

        return (
          <group
            key={side}
            // Well clear of the sill: the sill's front face reaches z 0.21, and a fold trough
            // dipping behind that is what showed cream dashes through the closed curtains.
            position={[x, -0.06, 0.34]}
            rotation={[0, side * 0.2 * open, side * 0.03 * open]}
            scale={[squeeze, 1, 1]}
          >
            <mesh
              castShadow
              geometry={curtainPanel(panelWidth, height + 0.5, open)}
              onPointerDown={onDown(side)}
              onClick={onClick(side)}
              onPointerOver={(e) => {
                e.stopPropagation()
                if (!drag.current) document.body.style.cursor = 'ew-resize'
              }}
              onPointerOut={(e) => {
                e.stopPropagation()
                if (!drag.current) document.body.style.cursor = 'auto'
              }}
            >
              <meshStandardMaterial
                map={velvet.map}
                normalMap={velvet.normalMap}
                roughnessMap={velvet.roughnessMap}
                color="#A87B41"
                roughness={0.82}
                metalness={0.08}
                side={2}
                normalScale={[0.9, 0.9]}
              />
            </mesh>
          </group>
        )
      })}

      {/* Sheer under-curtain, sized exactly to the glass. It used to be taller than the
          opening, so its hem showed below the drapes as a pale horizontal band. */}
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[width - 0.02, height - 0.02]} />
        <meshStandardMaterial
          color="#E8DAC0"
          transparent
          opacity={0.38}
          roughness={0.95}
          side={2}
          emissive="#F0E2C8"
          emissiveIntensity={0.1}
          depthWrite={false}
        />
      </mesh>

    </group>
  )
}


/** Kept only as a safety net behind the walls; the camera should never see it. */
export function RoomEnvelope({ color }: { color: string }) {
  return (
    <mesh>
      <boxGeometry args={[60, 60, 60]} />
      <meshBasicMaterial color={color} side={BackSide} toneMapped={false} />
    </mesh>
  )
}

export { ROOM_WIDTH, ROOM_DEPTH, WALL_HEIGHT, HALF_W, HALF_D }
