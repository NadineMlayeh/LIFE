import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { PrivacyEntityType, Visibility } from '../../types'
import { privacyApi } from '../../services/lifeApi'
import { useState } from 'react'

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
  const [confirming, setConfirming] = useState(false)
  const shared = visibility === 'SHARE_ONLY'

  async function apply() {
    const next: Visibility = shared ? 'PRIVATE' : 'SHARE_ONLY'
    setSaving(true)
    try {
      await privacyApi.set(entityType, entityId, next)
      setVisibility(next)
      onChanged?.(next)
      setConfirming(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {/* Rendered inline rather than as a floating popover: the panel clips its own overflow
          to keep its rounded corners, which swallowed the popover entirely. */}
      <AnimatePresence>
        {confirming && (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 rounded-[3px] border px-3 py-1.5"
            style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--paper-lit)' }}
          >
            <span className="max-w-[16rem] text-[12px] leading-snug text-[var(--ink-soft)]">
              {shared
                ? 'Hide this again? Link holders lose access.'
                : 'Share this with anyone holding your link?'}
            </span>
            <button
              type="button"
              onClick={apply}
              disabled={saving}
              className="brass-button !px-3 !py-1 !text-[11px]"
            >
              {saving ? '…' : shared ? 'Hide' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="quiet-button !p-1 !text-[12px]"
            >
              No
            </button>
          </motion.span>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setConfirming((v) => !v)}
        disabled={saving}
        title={
          shared
            ? 'Anyone with your share link can see this'
            : 'Private — only you can see this'
        }
        className="group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition disabled:opacity-60"
        style={{
          borderColor: shared ? 'rgba(168,134,60,0.7)' : 'var(--rule)',
          backgroundColor: shared ? 'rgba(201,162,74,0.16)' : 'transparent',
        }}
      >
        <motion.span
          aria-hidden
          animate={{ rotate: shared ? 0 : -14, scale: shared ? 1 : 0.94 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="inline-block h-3 w-3 rounded-full"
          style={{
            background: shared
              ? 'radial-gradient(circle at 32% 30%, #E2C67E, #A8863C 70%)'
              : 'radial-gradient(circle at 32% 30%, #8E4A42, #5E2E28 70%)',
            boxShadow: 'inset 0 0 0 1px rgba(58,44,29,0.28)',
          }}
        />
        <span
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ color: shared ? '#7A5F1E' : 'var(--ink-soft)' }}
        >
          {label ? `${label} · ` : ''}
          {shared ? 'Shared' : 'Private'}
        </span>
      </button>
    </span>
  )
}
