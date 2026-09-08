import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { OutsideFocus } from '../room/OutsideScene'
import type { FocusTarget } from '../room/RoomScene'

/**
 * The first walk around the room.
 *
 * The trick that makes this cheap: **the camera already centres whatever it focuses on.** Each
 * step just asks the room to look at an object, and a radial mask then blurs and darkens
 * everything except the middle of the screen — which is exactly where that object now is. No
 * screen-space tracking of 3D positions, no measuring, nothing to keep in sync. Move the
 * camera and the spotlight is already correct.
 */

interface Stop {
  focus: FocusTarget
  /** Whether this stop is out in the garden rather than in the room. */
  outside?: boolean
  /** Which outdoor shot, for stops that are. */
  outsideFocus?: OutsideFocus
  title: string
  body: string
}

const STOPS: Stop[] = [
  {
    focus: 'overview',
    title: 'This is your room',
    body: 'Everything that belongs to your life can be kept here — what you have done, where you have been, the people in it, and whatever you want to remember of it. It is all recorded in this one place, and it is private until you decide otherwise.',
  },
  {
    focus: 'bookshelf',
    title: 'The bookshelf',
    body: 'Your library. Each volume is a subject — family, work, travel — and inside it chapters you write freely, like a diary you keep by theme. Sixteen books fit on the shelf; the rest wait in the full library.',
  },
  {
    focus: 'clock',
    title: 'The longcase clock',
    body: 'Your timeline. Moments in the order they happened, with the real distance between them shown on the connectors. Goals go here too, and the clock asks you later whether you managed them.',
  },
  {
    focus: 'mirror',
    title: 'The mirror',
    body: 'Where you look at yourself. The plain record of who you are, a private notebook nobody can ever be given access to, and the keys that decide who may visit your room.',
  },
  {
    focus: 'map',
    title: 'The map',
    body: 'Everywhere you have been, and everywhere you still mean to go. Filled pins are behind you, hollow ones ahead. Each country can carry a date and whatever you want to remember of it.',
  },
  {
    focus: 'frames',
    title: 'The photo frame',
    body: 'Your album, kept as prints on paper leaves you turn. Whichever photograph you hang in this frame is the one visitors see first, so choose it the way you would choose one for a wall.',
  },
  {
    focus: 'window',
    title: 'The window',
    body: 'Not only a view: click the glass and you step outside.',
  },
  {
    focus: 'overview',
    outside: true,
    outsideFocus: 'mailbox',
    title: 'The post box',
    body: 'Out by the gate. Letters go to people by their username, never an email address, and you can enclose a key to your room with one so they can let themselves in. When post is waiting, the flag stands up.',
  },
  {
    focus: 'window',
    title: 'And two things just for the pleasure of it',
    body: 'The curtains actually move. Take hold of one and draw it across, and the room genuinely darkens — the daylight is doing real work, not pretending.',
  },
  {
    focus: 'switch',
    title: 'The light switch',
    body: 'The room keeps your own clock, so it dims as your evening comes on. When the daylight can no longer carry it, this brings the lamp up. That is everything — go and look around.',
  },
]

const SEEN_KEY = 'life_tour_seen'

/** Whether this browser has been shown the room before. */
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === 'yes'
  } catch {
    // A browser with storage blocked simply gets the tour again; that is the harmless failure.
    return false
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, 'yes')
  } catch {
    /* nothing to do — the tour will just offer itself again next time */
  }
}

export function RoomTour({
  open,
  onFocus,
  onGo,
  onFocusOutside,
  onClose,
}: {
  open: boolean
  /** Points the room's camera at the object being described. */
  onFocus: (target: FocusTarget) => void
  /** Moves between the room and the garden, since the post box is not indoors. */
  onGo: (where: 'inside' | 'outside') => void
  /** Frames a thing that is outdoors, so the spotlight lands on it. */
  onFocusOutside: (focus: OutsideFocus) => void
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const stop = STOPS[step]

  // The camera leads and the card follows, so the object is already settled when you read it.
  // A stop that lives outdoors moves you there first; the garden has one fixed view, so only
  // the room needs a focus target.
  useEffect(() => {
    if (!open) return
    const here = STOPS[step]
    onGo(here.outside ? 'outside' : 'inside')
    if (here.outside) onFocusOutside(here.outsideFocus ?? 'overview')
    else onFocus(here.focus)
  }, [open, step, onFocus, onGo, onFocusOutside])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function finish() {
    markTourSeen()
    setStep(0)
    onGo('inside')
    onFocusOutside('overview')
    onFocus('overview')
    onClose()
  }

  function next() {
    if (step >= STOPS.length - 1) finish()
    else setStep((s) => s + 1)
  }

  const last = step === STOPS.length - 1

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/*
            The spotlight. One mask, used twice: once on a blur layer and once on a darkening
            layer, so the edges of the room go soft *and* dim while the middle stays sharp.
            `pointer-events-none` throughout — the tour explains the room, it does not take it
            away, and the object being described stays clickable.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backdropFilter: 'blur(7px)',
              WebkitBackdropFilter: 'blur(7px)',
              WebkitMaskImage:
                'radial-gradient(circle at 50% 42%, transparent 0 20%, black 46%)',
              maskImage: 'radial-gradient(circle at 50% 42%, transparent 0 20%, black 46%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: 'rgba(34, 22, 10, 0.62)',
              WebkitMaskImage:
                'radial-gradient(circle at 50% 42%, transparent 0 18%, black 48%)',
              maskImage: 'radial-gradient(circle at 50% 42%, transparent 0 18%, black 48%)',
            }}
          />

          <div className="absolute inset-x-0 bottom-0 flex justify-center p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="paper relative w-full max-w-md rounded-[3px] px-7 py-6"
                style={{ boxShadow: 'var(--lift-lg)' }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[3px]"
                  style={{
                    border: '2px solid transparent',
                    backgroundImage:
                      'linear-gradient(150deg, #E4C579 0%, #A8863C 26%, #7A5B26 52%, #C9A24A 78%, #8A6A2C 100%)',
                    backgroundOrigin: 'border-box',
                    WebkitMask: 'linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />

                <p className="small-caps mb-1 text-[var(--ink-faint)]">
                  {step + 1} of {STOPS.length}
                </p>
                <h2 className="display mb-2 text-[22px] leading-tight">{stop.title}</h2>
                <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">{stop.body}</p>

                <div className="mt-5 flex items-center gap-3">
                  <button onClick={next} className="brass-button">
                    {last ? 'Let me look around' : 'Next'}
                  </button>

                  {step > 0 && (
                    <button onClick={() => setStep((s) => s - 1)} className="quiet-button">
                      Back
                    </button>
                  )}

                  {!last && (
                    <button onClick={finish} className="quiet-button ml-auto">
                      Skip the tour
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
