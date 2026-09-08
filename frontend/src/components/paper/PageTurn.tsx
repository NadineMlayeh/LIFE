import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A two-page spread with a real page turn.
 *
 * The physics that matter:
 *
 *  1. **You never turn both pages.** Going forward you lift the *right* page and swing it
 *     left; going back you lift the *left* page and swing it right. The other page does not
 *     move at all, and neither does the page being uncovered — it was lying there the whole
 *     time. Animating the whole spread is the tell that gives away a fake.
 *  2. **Four pages are on screen during a turn**, not two. Turning forward from 2|3 to 4|5,
 *     page 2 stays put, page 3 is the front of the turning leaf, page 4 is its *back*, and
 *     page 5 is revealed underneath. This is why books are bound in spreads.
 *  3. **The pivot is the spine** — the centre line — not the element's own middle.
 *  4. **The fold darkens.** A shadow peaking as the leaf goes edge-on does more for the
 *     illusion than the rotation, because it implies a light in the room.
 *
 * Being a spread is also what makes the back face visible at all. A 180° rotation about an
 * edge always ends up outside the box it started in, so the leaf needs somewhere to land —
 * here it lands on the other half of the spread, which is still inside the container. In the
 * single-page version this replaced, the second half of every turn fell off the edge.
 *
 * Pages are addressed by index and drawn on demand through `renderPage`, so nothing is
 * snapshotted and React keeps ownership of every element. Live content — fields that save
 * themselves, portalled bubbles — keeps working straight through a turn.
 *
 * See `docs/PAGE-TURN.md`.
 */
export function PageTurn({
  leaf,
  direction,
  renderPage,
  duration = 1.15,
  gap = '2rem',
}: {
  /** Which spread is open. Leaf n shows pages 2n and 2n+1. A change to this turns the page. */
  leaf: number
  /** 1 turns forward (the right page swings left), -1 turns back (the left page swings right). */
  direction: number
  /** Draws the page at an index. Return null past the end — a book ends on a blank leaf. */
  renderPage: (pageIndex: number) => ReactNode
  /**
   * Seconds for the whole turn. Paper is heavy and a hand is slow: under about a second the
   * leaf reads as a slide transition rather than as something being lifted.
   */
  duration?: number
  gap?: string
}) {
  const reduceMotion = useReducedMotion()
  const [turn, setTurn] = useState<{ from: number; to: number; dir: number } | null>(null)
  const shown = useRef(leaf)

  useLayoutEffect(() => {
    if (shown.current === leaf) return
    const from = shown.current
    shown.current = leaf
    if (!reduceMotion) setTurn({ from, to: leaf, dir: direction })
  })

  const forward = (turn?.dir ?? 1) > 0

  // While a leaf is in the air the two halves belong to different spreads: the half it is
  // lifting from still shows the old page, and the half it is uncovering already shows the new.
  const leftIndex = turn ? (forward ? turn.from : turn.to) * 2 : leaf * 2
  const rightIndex = turn ? (forward ? turn.to : turn.from) * 2 + 1 : leaf * 2 + 1

  // The turning leaf: the page you were reading on its front, the page you are turning to on
  // its back — they are two sides of one sheet.
  const frontIndex = turn ? (forward ? turn.from * 2 + 1 : turn.from * 2) : 0
  const backIndex = turn ? (forward ? turn.to * 2 : turn.to * 2 + 1) : 0

  return (
    <div
      className="relative overflow-hidden"
      // Perspective belongs to the viewer, so it sits on the container. Put it on the leaf and
      // every page gets its own vanishing point, which reads as a card spinning rather than
      // paper folding.
      //
      // `overflow-hidden` is load-bearing: a rotated element still contributes to scrollable
      // overflow, so without it the turn pushes a scrollbar into the panel.
      style={{ perspective: 2400 }}
    >
      <div className="flex" style={{ gap }}>
        <div className="min-w-0 flex-1">{renderPage(leftIndex)}</div>
        <div
          className="min-w-0 flex-1"
          style={{ borderLeft: '1px solid var(--rule)', paddingLeft: gap }}
        >
          {renderPage(rightIndex)}
        </div>
      </div>

      <AnimatePresence>
        {turn && (
          <motion.div
            className="pointer-events-none absolute top-0 bottom-0"
            style={{
              // The leaf covers exactly the half it is lifting from, hinged on the spine.
              left: forward ? '50%' : 0,
              right: forward ? 0 : '50%',
              transformOrigin: forward ? 'left center' : 'right center',
              transformStyle: 'preserve-3d',
            }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: forward ? -180 : 180 }}
            // Eases in gently — a page has to be lifted before it can fall — then carries
            // through and settles. A symmetric ease looks motorised.
            transition={{ duration, ease: [0.52, 0.02, 0.28, 1] }}
            onAnimationComplete={() => setTurn(null)}
          >
            <Face pad={gap} padded={forward}>
              {renderPage(frontIndex)}
            </Face>

            {/* The reverse of that same sheet, pre-mirrored so it reads the right way round
                once the leaf passes 90°. It lands on the opposite half, so its padding
                mirrors too. */}
            <Face pad={gap} padded={!forward} mirrored>
              {renderPage(backIndex)}
            </Face>

            {/* The leaf's own shade, deepest as it goes edge-on to the light. */}
            <motion.div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage: forward
                  ? 'linear-gradient(90deg, rgba(58,42,26,0.40), rgba(58,42,26,0.03))'
                  : 'linear-gradient(270deg, rgba(58,42,26,0.40), rgba(58,42,26,0.03))',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.9, 0] }}
              transition={{ duration, ease: 'easeInOut', times: [0, 0.55, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* The shadow the lifted leaf throws across the page it is uncovering. Sits over the
          static half, so it darkens what is being revealed rather than the leaf itself. */}
      <AnimatePresence>
        {turn && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0"
            style={{
              left: forward ? 0 : '50%',
              right: forward ? '50%' : 0,
              backgroundImage: forward
                ? 'linear-gradient(270deg, rgba(58,42,26,0.34), transparent 70%)'
                : 'linear-gradient(90deg, rgba(58,42,26,0.34), transparent 70%)',
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * One side of the turning sheet. Opaque paper, so neither face lets the static page beneath
 * show through, and hidden the moment it points away from the viewer.
 */
function Face({
  pad,
  padded,
  mirrored,
  children,
}: {
  pad: string
  /** Whether this face sits on the right-hand half, which carries the gutter padding. */
  padded: boolean
  mirrored?: boolean
  children: ReactNode
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backfaceVisibility: 'hidden',
        transform: mirrored ? 'rotateY(180deg)' : undefined,
        backgroundColor: 'var(--paper)',
        paddingLeft: padded ? pad : undefined,
        paddingRight: padded ? undefined : pad,
      }}
    >
      {children}
    </div>
  )
}
