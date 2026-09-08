import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

/**
 * Content opens *in* the room, never instead of it. The room stays rendered behind, pushed
 * out of focus, and the content arrives as a sheet of paper settling onto it.
 *
 * `variant` decides how the paper behaves:
 *  - `sheet`   a single page — identity, notes, most forms
 *  - `spread`  a two-page book opening — the library
 *  - `scroll`  a tall narrow column — the timeline
 */
export type PanelVariant = 'sheet' | 'spread' | 'scroll'

const WIDTHS: Record<PanelVariant, string> = {
  sheet: 'max-w-2xl',
  spread: 'max-w-5xl',
  scroll: 'max-w-xl',
}

export function Panel({
  open,
  onClose,
  title,
  subtitle,
  variant = 'sheet',
  actions,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  variant?: PanelVariant
  /** Rendered in the header's right-hand side — usually a privacy control. */
  actions?: ReactNode
  children: ReactNode
}) {
  // Escape closes, and the room shouldn't scroll behind an open sheet.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
        >
          {/* The room, dimmed and defocused rather than replaced. */}
          {/* A plain wash, not a backdrop-filter. `backdrop-blur` re-blurs everything behind it
              on every repaint, so each keystroke in the form re-filtered the entire room. */}
          <motion.button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default"
            style={{ backgroundColor: 'rgba(44, 32, 18, 0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={`paper relative flex w-full ${WIDTHS[variant]} flex-col overflow-hidden rounded-[3px]`}
            initial={{ opacity: 0, y: 26, scale: 0.985, rotateX: 6 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}
            style={{ transformPerspective: 1200 }}
          >
            <PaperEdge />

            <header className="flex shrink-0 items-start justify-between gap-4 px-8 pt-7 pb-4">
              <div>
                {subtitle && <p className="small-caps mb-1">{subtitle}</p>}
                <h2 className="display text-[26px] leading-tight">{title}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {actions}
                <button onClick={onClose} className="quiet-button" aria-label="Close">
                  Close
                </button>
              </div>
            </header>

            <div className="mx-8 hairline-double shrink-0" />

            {/*
              A fixed working height. Sizing to content made the sheet jump every time you
              switched between identity and the notebook — the paper appeared to reload. It
              scrolls only when the content genuinely exceeds this.
            */}
            <div
              className="min-h-0 flex-1 overflow-y-auto px-8 py-6"
              style={{ height: 'min(58vh, 30rem)' }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * A torn deckle down both sides of the sheet, drawn as a repeating gradient rather than an
 * image. Small thing, but a perfectly straight edge is what makes paper read as a div.
 */
function PaperEdge() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[6px]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(160,132,86,0.22) 0 3px, transparent 3px 7px, rgba(160,132,86,0.12) 7px 10px, transparent 10px 15px)',
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[6px]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(160,132,86,0.18) 0 4px, transparent 4px 9px, rgba(160,132,86,0.14) 9px 12px, transparent 12px 16px)',
        }}
      />
    </>
  )
}
