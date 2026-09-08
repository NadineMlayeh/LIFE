import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import type { Book } from '../types'
import { PALETTE, hashString, variantFrom } from './palette'
import { createPaperMaps, createSpineMaps, createWoodMaps } from './textures'

// Deliberately the largest object in the room: it is the piece that actually does something,
// so it should hold the eye rather than the furniture.
const SHELF_WIDTH = 1.52
const SHELF_DEPTH = 0.32
const CASE_HEIGHT = 2.32
const SHELF_COUNT = 4
const BOARD = 0.045

interface ShelfBook {
  book: Book
  shelfIndex: number
  x: number
  variant: ReturnType<typeof variantFrom>
}

/**
 * Books are laid out shelf by shelf from real data, then each row is scaled so it genuinely
 * fills its shelf. Without that step a handful of books leaves a mostly empty case, which is
 * the single thing that made the shelf read as a display rather than someone's library.
 * Proportions still come from a hash of the book id, so the arrangement never reshuffles.
 */
function layoutBooks(books: Book[]): ShelfBook[] {
  if (books.length === 0) return []

  // The right-hand end of each shelf is reserved for the decorative objects.
  const leftEdge = -SHELF_WIDTH / 2 + 0.06
  const rightEdge = SHELF_WIDTH / 2 - 0.06 - 0.32
  const usable = rightEdge - leftEdge
  const gap = 0.005

  const rows: { book: Book; variant: ReturnType<typeof variantFrom> }[][] = Array.from(
    { length: SHELF_COUNT },
    () => [],
  )

  books.forEach((book, index) => {
    rows[index % SHELF_COUNT].push({ book, variant: variantFrom(book.id, index) })
  })

  const result: ShelfBook[] = []

  rows.forEach((row, shelfIndex) => {
    if (row.length === 0) return

    // Each shelf is packed to a slightly different fullness so they don't all look identical.
    const fill = 0.86 + hashString(`shelf:${shelfIndex}`) * 0.11
    const natural = row.reduce((sum, entry) => sum + entry.variant.thickness, 0)
    const target = usable * fill - gap * (row.length - 1)
    // Capped: with only a few books a row would otherwise stretch each one to absurd
    // thickness to fill the shelf. A part-empty shelf is the honest result — and that gap is
    // where "add a book" will live.
    const scale = Math.min(1.8, Math.max(0.9, target / natural))

    // Books stand from the left edge; whatever slack remains falls beside the objects.
    let cursor = leftEdge

    row.forEach(({ book, variant }) => {
      const thickness = variant.thickness * scale
      result.push({
        book,
        shelfIndex,
        x: cursor + thickness / 2,
        variant: { ...variant, thickness },
      })
      cursor += thickness + gap
    })
  })

  return result
}

export function Bookshelf({
  books,
  position,
  rotation = [0, 0, 0],
  onOpenBook,
  onFocus,
  onHoverBook,
}: {
  books: Book[]
  position: [number, number, number]
  rotation?: [number, number, number]
  onOpenBook: (book: Book) => void
  onFocus: () => void
  onHoverBook: (title: string | null) => void
}) {
  // Warm honeyed walnut rather than the near-black brown it was: a big slab of very dark,
  // heavily grained timber read as crude joinery.
  const caseMaps = useMemo(
    () =>
      createWoodMaps({
        seed: 21,
        light: '#C29A66',
        dark: '#8A6038',
        size: 512,
        repeat: 2,
        ringFrequency: 11,
        knots: 1,
      }),
    [],
  )

  // The back panel sits in shadow and takes a quieter, flatter figure so it reads as a recess
  // behind the books instead of another expanse of grain.
  const panelMaps = useMemo(
    () =>
      createWoodMaps({
        seed: 47,
        light: '#8E6B48',
        dark: '#6B4E33',
        size: 256,
        repeat: 2,
        ringFrequency: 16,
        knots: 0,
      }),
    [],
  )

  const laid = useMemo(() => layoutBooks(books), [books])
  const shelfGap = (CASE_HEIGHT - BOARD) / SHELF_COUNT

  return (
    <group position={position} rotation={rotation}>
      {/* back panel */}
      <mesh position={[0, CASE_HEIGHT / 2, -SHELF_DEPTH / 2]} receiveShadow>
        <boxGeometry args={[SHELF_WIDTH, CASE_HEIGHT, 0.03]} />
        <meshStandardMaterial
          map={panelMaps.map}
          normalMap={panelMaps.normalMap}
          roughnessMap={panelMaps.roughnessMap}
          color="#9A7550"
          roughness={0.8}
        />
      </mesh>

      {/* sides */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(side * (SHELF_WIDTH - BOARD)) / 2, CASE_HEIGHT / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[BOARD, CASE_HEIGHT, SHELF_DEPTH]} />
          <meshStandardMaterial
            map={caseMaps.map}
            normalMap={caseMaps.normalMap}
            roughnessMap={caseMaps.roughnessMap}
            roughness={0.62}
          />
        </mesh>
      ))}

      {/* shelf boards, including top and bottom */}
      {Array.from({ length: SHELF_COUNT + 1 }).map((_, i) => (
        <mesh key={i} position={[0, i * shelfGap, 0]} castShadow receiveShadow>
          <boxGeometry args={[SHELF_WIDTH, BOARD, SHELF_DEPTH]} />
          <meshStandardMaterial
            map={caseMaps.map}
            normalMap={caseMaps.normalMap}
            roughnessMap={caseMaps.roughnessMap}
            roughness={0.62}
          />
        </mesh>
      ))}

      {/* Concealed strip lighting under each shelf, washing down over the books below. This
          is what makes a bookcase feel inhabited rather than stored: light at eye level,
          inside the furniture, rather than only from the ceiling. */}
      {Array.from({ length: SHELF_COUNT }).map((_, i) => {
        const y = (i + 1) * shelfGap - BOARD / 2 - 0.012
        return (
          <group key={`light-${i}`}>
            {/* the visible strip, tucked behind the shelf's front edge */}
            <mesh position={[0, y, SHELF_DEPTH / 2 - 0.055]}>
              <boxGeometry args={[SHELF_WIDTH - 0.14, 0.012, 0.016]} />
              <meshBasicMaterial color="#FFE3B4" toneMapped={false} />
            </mesh>
            {/* One unshadowed fill per shelf. Every extra point light costs shader work, so
                this is the fewest that still lifts the spines out of the dark. */}
            <pointLight
              position={[0, y - 0.05, 0.03]}
              color="#FFD8A2"
              intensity={0.7}
              distance={1.15}
              decay={1.9}
            />
          </group>
        )
      })}

      {/* moulded cornice, in two steps so the case doesn't end on a bare edge */}
      <mesh position={[0, CASE_HEIGHT + 0.035, 0.01]} castShadow>
        <boxGeometry args={[SHELF_WIDTH + 0.07, 0.05, SHELF_DEPTH + 0.04]} />
        <meshStandardMaterial map={caseMaps.map} normalMap={caseMaps.normalMap} roughness={0.5} />
      </mesh>
      <mesh position={[0, CASE_HEIGHT + 0.085, 0.02]} castShadow>
        <boxGeometry args={[SHELF_WIDTH + 0.13, 0.055, SHELF_DEPTH + 0.08]} />
        <meshStandardMaterial map={caseMaps.map} normalMap={caseMaps.normalMap} roughness={0.5} />
      </mesh>
      {/* gilt bead along the cornice, tying it to the rest of the room's brass */}
      <mesh position={[0, CASE_HEIGHT + 0.058, SHELF_DEPTH / 2 + 0.042]}>
        <boxGeometry args={[SHELF_WIDTH + 0.09, 0.012, 0.012]} />
        <meshStandardMaterial color={PALETTE.brass} roughness={0.35} metalness={0.85} />
      </mesh>

      {/* plinth */}
      <mesh position={[0, 0.045, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[SHELF_WIDTH + 0.08, 0.09, SHELF_DEPTH + 0.04]} />
        <meshStandardMaterial map={caseMaps.map} normalMap={caseMaps.normalMap} roughness={0.55} />
      </mesh>

      <ShelfObjects shelfGap={shelfGap} />

      {laid.map(({ book, shelfIndex, x, variant }) => (
        <BookSpine
          key={book.id}
          book={book}
          variant={variant}
          position={[x, shelfIndex * shelfGap + BOARD / 2, 0.01]}
          onHover={onHoverBook}
          onOpen={() => {
            onFocus()
            onOpenBook(book)
          }}
        />
      ))}
    </group>
  )
}

/**
 * A few objects standing among the books — a globe, a small brass box, a stack lying flat.
 * Purely decorative, and the thing that stops the case reading as a filing system. They sit
 * at the right-hand end of shelves where the fill algorithm leaves room.
 */
function ShelfObjects({ shelfGap }: { shelfGap: number }) {
  const brass = (
    <meshStandardMaterial color={PALETTE.brass} roughness={0.32} metalness={0.85} />
  )

  return (
    <group>
      {/* globe on the top shelf */}
      <group position={[SHELF_WIDTH / 2 - 0.16, shelfGap * 2 + BOARD / 2 + 0.115, 0.02]}>
        <mesh castShadow>
          <sphereGeometry args={[0.075, 24, 18]} />
          <meshStandardMaterial color="#7A8F7E" roughness={0.75} metalness={0.05} />
        </mesh>
        <mesh position={[0, -0.085, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.055, 0.03, 16]} />
          {brass}
        </mesh>
        <mesh rotation={[0, 0, 0.35]}>
          <torusGeometry args={[0.084, 0.005, 8, 32]} />
          {brass}
        </mesh>
      </group>

      {/* books lying flat, middle shelf */}
      <group position={[SHELF_WIDTH / 2 - 0.2, shelfGap + BOARD / 2, 0.01]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[i * 0.004, 0.021 + i * 0.036, 0]} castShadow>
            <boxGeometry args={[0.22 - i * 0.015, 0.034, 0.17]} />
            <meshStandardMaterial
              color={['#6B4A6B', '#8C4A32', '#3F5D52'][i]}
              roughness={0.85}
            />
          </mesh>
        ))}
      </group>

      {/* small brass keepsake box, bottom shelf */}
      <group position={[SHELF_WIDTH / 2 - 0.17, BOARD / 2 + 0.035, 0.02]}>
        <mesh castShadow>
          <boxGeometry args={[0.14, 0.07, 0.1]} />
          {brass}
        </mesh>
        <mesh position={[0, 0.042, 0]} castShadow>
          <boxGeometry args={[0.148, 0.014, 0.108]} />
          <meshStandardMaterial color="#5E4632" roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}

function BookSpine({
  book,
  variant,
  position,
  onOpen,
  onHover,
}: {
  book: Book
  variant: ReturnType<typeof variantFrom>
  position: [number, number, number]
  onOpen: () => void
  onHover: (title: string | null) => void
}) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)

  // One neutral cloth map for every book on the shelf, tinted per book through the material
  // colour. Three multiplies map × color, so this gives varied covers from a single texture.
  const coverMaps = createPaperMaps({ seed: 91, color: '#FFFFFF', size: 256 })
  // Three tooled-binding variants, picked deterministically so a shelf isn't uniform.
  const spineMaps = createSpineMaps(Math.floor(hashString(`${book.id}:spine`) * 3))

  // Hovering eases the book out of the shelf and straightens it a little, the way you would
  // tip one out with a finger. Deliberately small — the spec asks for "tiny movement".
  useFrame((_, delta) => {
    if (!group.current) return
    const k = 1 - Math.pow(0.0001, delta)
    const targetZ = hovered ? 0.075 : 0
    const targetLean = hovered ? variant.lean * 0.25 : variant.lean
    const targetY = hovered ? 0.012 : 0

    group.current.position.z += (targetZ - group.current.position.z) * k
    group.current.rotation.z += (targetLean - group.current.rotation.z) * k
    group.current.position.y += (position[1] + variant.height / 2 + targetY - group.current.position.y) * k
  })

  return (
    <group
      ref={group}
      position={[position[0], position[1] + variant.height / 2, position[2]]}
      rotation={[0, 0, variant.lean]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover(book.title)
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
      {/* Box faces are ordered +X, -X, +Y, -Y, +Z, -Z. Only +Z — the spine you actually see
          on a shelf — gets the tooled binding; the rest is plain leather and page block. */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[variant.thickness, variant.height, variant.depth]} />
        <meshStandardMaterial attach="material-0" color={variant.color} map={coverMaps.map} roughness={0.78} />
        <meshStandardMaterial attach="material-1" color={variant.color} map={coverMaps.map} roughness={0.78} />
        <meshStandardMaterial attach="material-2" color={PALETTE.paper} roughness={0.95} />
        <meshStandardMaterial attach="material-3" color={PALETTE.paper} roughness={0.95} />
        <meshStandardMaterial
          attach="material-4"
          color={variant.color}
          map={spineMaps.map}
          roughnessMap={spineMaps.roughnessMap}
          metalnessMap={spineMaps.gilt}
          emissiveMap={spineMaps.gilt}
          emissive={PALETTE.brass}
          emissiveIntensity={hovered ? 0.85 : 0.42}
          roughness={0.8}
          metalness={0.95}
        />
        {/* -Z is the fore-edge, facing into the shelf: page block, not leather */}
        <meshStandardMaterial attach="material-5" color={PALETTE.paper} roughness={0.95} />
      </mesh>

      <SpineDressing variant={variant} />
    </group>
  )
}

/**
 * The five raised cords a hand-bound book is sewn onto. Only the relief is geometry — every
 * gilt line and fleuron comes from the spine texture, which is why the ornament can be as
 * fine as it is. Positions match the bands drawn in `createSpineMaps`.
 */
function SpineDressing({ variant }: { variant: ReturnType<typeof variantFrom> }) {
  const w = variant.thickness
  const h = variant.height
  const faceZ = variant.depth / 2

  // Texture t is measured from the head; the mesh runs bottom-up, hence 0.5 - t.
  const bands = [0.145, 0.315, 0.485, 0.655, 0.825]

  return (
    <group>
      {bands.map((t, i) => (
        <mesh key={i} position={[0, h * (0.5 - t), faceZ - 0.006]} castShadow>
          <boxGeometry args={[w * 1.03, h * 0.026, variant.depth * 0.055]} />
          <meshStandardMaterial color={variant.color} roughness={0.62} metalness={0.05} />
        </mesh>
      ))}
    </group>
  )
}

export { SHELF_WIDTH, CASE_HEIGHT }
