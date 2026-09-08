import { AnimatePresence, motion } from 'motion/react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { PrivacyEntityType, Visibility } from '../../types'
import { privacyApi } from '../../services/lifeApi'
import { useEffect, useRef, useState } from 'react'

/** A label set above a ruled line, the way a printed form is laid out. */
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="small-caps mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="ruled-field"
      />
      {hint && <span className="mt-1 block text-[12px] text-[var(--ink-faint)]">{hint}</span>}
    </label>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="block">
      {label && <span className="small-caps mb-1.5 block">{label}</span>}
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="ruled-field resize-y leading-relaxed"
        style={{
          // Faint horizontal rules behind the text, like writing paper.
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0 27px, rgba(58,44,29,0.12) 27px 28px)',
          backgroundAttachment: 'local',
          lineHeight: '28px',
        }}
      />
    </label>
  )
}

/** A read-only fact printed on the page: label above, value on the rule. */
export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span className="small-caps mb-1 block">{label}</span>
      <p className="border-b border-[var(--rule)] pb-1.5 text-[15px] text-[var(--ink)]">
        {value ?? <span className="text-[var(--ink-faint)]">—</span>}
      </p>
    </div>
  )
}

/**
 * A wax-seal style privacy switch. Private is a pressed seal; shared is an open brass tag.
 * Reads as something you'd physically flip rather than a checkbox.
 */
export function PrivacySeal({
  entityType,
  entityId,
  value,
  onChanged,
  label,
}: {
  entityType: PrivacyEntityType
  entityId: string
  value: Visibility
  onChanged?: (next: Visibility) => void
  label?: string
}) {
  const [visibility, setVisibility] = useState<Visibility>(value)
  const [saving, setSaving] = useState(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const shared = visibility === 'SHARE_ONLY'

  useEffect(() => setVisibility(value), [value])

  async function apply() {
    const next: Visibility = shared ? 'PRIVATE' : 'SHARE_ONLY'
    setSaving(true)
    try {
      await privacyApi.set(entityType, entityId, next)
      setVisibility(next)
      onChanged?.(next)
      setAnchor(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setAnchor(anchor ? null : (button.current?.getBoundingClientRect() ?? null))}
        disabled={saving}
        title={shared ? 'Anyone with your share link can see this' : 'Private — only you can see this'}
        className="inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 transition disabled:opacity-60"
        style={{
          borderColor: shared ? 'rgba(168,134,60,0.7)' : 'var(--rule)',
          backgroundColor: shared ? 'rgba(201,162,74,0.16)' : 'transparent',
        }}
      >
        <motion.span
          aria-hidden
          animate={{ rotate: shared ? 0 : -14, scale: shared ? 1 : 0.94 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{
            background: shared
              ? 'radial-gradient(circle at 32% 30%, #E2C67E, #A8863C 70%)'
              : 'radial-gradient(circle at 32% 30%, #8E4A42, #5E2E28 70%)',
            boxShadow: 'inset 0 0 0 1px rgba(58,44,29,0.28)',
          }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.14em]"
          style={{ color: shared ? '#7A5F1E' : 'var(--ink-soft)' }}
        >
          {label ? `${label} · ` : ''}
          {shared ? 'Shared' : 'Private'}
        </span>
      </button>

      <ConfirmBubble
        anchor={anchor}
        onDismiss={() => setAnchor(null)}
        question={
          shared
            ? 'Make this private again? Anyone holding your link loses access.'
            : 'Share this with anyone holding your link?'
        }
        confirmLabel={shared ? 'Make private' : 'Share it'}
        busy={saving}
        onConfirm={apply}
      />
    </>
  )
}

/**
 * A confirmation bubble rendered through a portal, anchored under whatever opened it.
 *
 * Two earlier attempts failed for opposite reasons: a popover inside the panel was clipped
 * away by the panel's `overflow-hidden`, and an inline strip pushed every neighbouring
 * element sideways. A portal escapes the clipping *and* takes no space in the layout.
 */
export function ConfirmBubble({
  anchor,
  question,
  confirmLabel,
  busy,
  onConfirm,
  onDismiss,
}: {
  anchor: DOMRect | null
  question: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onDismiss: () => void
}) {
  useEffect(() => {
    if (!anchor) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anchor, onDismiss])

  if (typeof document === 'undefined') return null

  const WIDTH = 250
  // Kept on screen when the anchor sits near the right edge.
  const left = anchor
    ? Math.min(Math.max(12, anchor.right - WIDTH), window.innerWidth - WIDTH - 12)
    : 0

  return createPortal(
    <AnimatePresence>
      {anchor && (
        <>
          <motion.div
            className="fixed inset-0 z-[60]"
            style={{ backdropFilter: 'blur(2px)', backgroundColor: 'rgba(44,32,18,0.18)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onDismiss}
          />
          <motion.div
            role="dialog"
            className="fixed z-[61] rounded-[3px] border p-3"
            style={{
              top: anchor.bottom + 8,
              left,
              width: WIDTH,
              borderColor: 'var(--rule)',
              backgroundColor: 'var(--paper-lit)',
              boxShadow: 'var(--lift-md)',
            }}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <p className="mb-2.5 text-[13px] leading-snug text-[var(--ink)]">{question}</p>
            <div className="flex items-center gap-2">
              <button onClick={onConfirm} disabled={busy} className="brass-button">
                {busy ? '…' : confirmLabel}
              </button>
              <button onClick={onDismiss} className="quiet-button">
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/**
 * A small explicative bubble shown while the pointer rests on a control, for buttons whose
 * label cannot carry the whole meaning on its own — "Put away" and "Shelve" both move a book,
 * and only a sentence makes clear which direction.
 *
 * Portalled for the same reason as {@link ConfirmBubble}: the panel clips its own overflow,
 * so anything anchored to a control near the edge would otherwise be cut off. It also opens
 * on focus, so the explanation is reachable from the keyboard rather than the mouse alone.
 */
export function Hint({ text, children }: { text: string; children: ReactNode }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  const show = () => setAnchor(ref.current?.getBoundingClientRect() ?? null)
  const hide = () => setAnchor(null)

  const WIDTH = 190
  // Centred under the control, then pulled back inside the viewport at either edge.
  const left = anchor
    ? Math.min(
        Math.max(10, anchor.left + anchor.width / 2 - WIDTH / 2),
        window.innerWidth - WIDTH - 10,
      )
    : 0

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {anchor && (
              <motion.span
                role="tooltip"
                className="pointer-events-none fixed z-[70] block rounded-[3px] border px-2.5 py-1.5 text-[12px] leading-snug"
                style={{
                  top: anchor.bottom + 7,
                  left,
                  width: WIDTH,
                  borderColor: 'var(--rule)',
                  backgroundColor: 'var(--paper-lit)',
                  color: 'var(--ink-soft)',
                  boxShadow: 'var(--lift-md)',
                }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
              >
                {text}
              </motion.span>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
