import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES, REGIONS, countryName, type CountryRef } from '../../data/countries'
import { CONTINENTS } from '../../room/worldShapes'
import { getErrorMessage } from '../../services/apiError'
import { mapApi, privacyApi } from '../../services/lifeApi'
import type { VisitedCountry, Visibility } from '../../types'
import { PrivacySeal } from './fields'
import { Panel } from './Panel'

type Status = 'visited' | 'future'

/**
 * The travel chart: a drawn world with a pin in every country you have been to, and the list
 * you choose them from.
 *
 * Privacy is **whole-map**, exactly as the timeline is whole-object. Sharing "some of the
 * countries you have visited" is a distinction without a difference — the shape of a life's
 * travel is the thing being shared, so it goes entire or not at all.
 */
export function MapPanel({
  open,
  onClose,
  userId,
  onCountriesChanged,
}: {
  open: boolean
  onClose: () => void
  userId: string
  /** Lets the room re-pin its wall map when the chart changes. */
  onCountriesChanged: () => void
}) {
  const [rows, setRows] = useState<VisitedCountry[]>([])
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (!open || loaded.current || !userId) return
    loaded.current = true
    Promise.all([mapApi.list(), privacyApi.get('MAP', [userId])])
      .then(([countries, privacy]) => {
        setRows(countries)
        setVisibility(privacy[userId] ?? 'PRIVATE')
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not open your chart.')))
      .finally(() => setLoading(false))
  }, [open, userId])

  const byCode = useMemo(() => {
    const map: Record<string, VisitedCountry> = {}
    for (const row of rows) map[row.countryCode] = row
    return map
  }, [rows])

  async function setStatus(code: string, status: Status | null) {
    // Writes go through immediately, but the list is patched locally so the whole chart does
    // not blink on every pin.
    try {
      if (status === null) {
        await mapApi.remove(code)
        setRows((current) => current.filter((r) => r.countryCode !== code))
        setOpenCode((c) => (c === code ? null : c))
      } else {
        const saved = await mapApi.upsert({ countryCode: code, status })
        setRows((current) => {
          const rest = current.filter((r) => r.countryCode !== code)
          return [...rest, saved]
        })
      }
      onCountriesChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'That change did not stick.'))
    }
  }

  function patchRow(saved: VisitedCountry) {
    setRows((current) => current.map((r) => (r.countryCode === saved.countryCode ? saved : r)))
  }

  const visitedCount = rows.filter((r) => r.status === 'visited').length
  const futureCount = rows.filter((r) => r.status === 'future').length

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return COUNTRIES.filter((country) => {
      const row = byCode[country.code]
      if (filter !== 'all' && row?.status !== filter) return false
      if (!q) return true
      return (
        country.name.toLowerCase().includes(q) || country.code.toLowerCase() === q
      )
    })
  }, [query, filter, byCode])

  return (
    <Panel
      open={open}
      onClose={onClose}
      subtitle="The chart"
      title="Where I have been"
      variant="spread"
      steady
      actions={
        <PrivacySeal
          entityType="MAP"
          entityId={userId}
          value={visibility}
          onChanged={setVisibility}
        />
      }
    >
      {loading ? (
        <p className="py-10 text-center text-[var(--ink-faint)]">Unrolling…</p>
      ) : (
        <>
          {error && <p className="mb-4 text-sm break-words text-[var(--oxblood)]">{error}</p>}

          <Chart rows={rows} onPick={setOpenCode} openCode={openCode} />

          <p className="mt-4 text-[13px] text-[var(--ink-soft)]">
            {visitedCount === 0 && futureCount === 0
              ? 'Nothing pinned yet. Find a country below and mark it.'
              : `${visitedCount} ${visitedCount === 1 ? 'country' : 'countries'} behind you` +
                (futureCount > 0 ? ` · ${futureCount} still to come` : '')}
          </p>

          <div className="mt-6 mb-4 flex flex-wrap items-end gap-4">
            <label className="min-w-0 flex-1">
              <span className="small-caps mb-1 block">Find a country</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tunisia, Japan, Peru…"
                className="ruled-field w-full"
              />
            </label>

            <div className="flex gap-2">
              {(['all', 'visited', 'future'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="quiet-button"
                  style={{
                    color: filter === f ? 'var(--ink)' : 'var(--ink-faint)',
                    borderBottom: filter === f ? '1px solid var(--brass)' : '1px solid transparent',
                  }}
                >
                  {f === 'all' ? 'Everywhere' : f === 'visited' ? 'Been' : 'To come'}
                </button>
              ))}
            </div>
          </div>

          <CountryList
            countries={matches}
            byCode={byCode}
            openCode={openCode}
            onToggleOpen={(code) => setOpenCode((c) => (c === code ? null : code))}
            onSetStatus={setStatus}
            onPatched={patchRow}
          />

          {matches.length === 0 && (
            <p className="py-8 text-center text-[13px] italic text-[var(--ink-faint)]">
              Nothing here by that name.
            </p>
          )}
        </>
      )}
    </Panel>
  )
}

/**
 * The drawn chart. Continent outlines come from the same coarse polygons the room's wall map
 * uses, so the paper chart and the object on the wall are recognisably the same map.
 */
function Chart({
  rows,
  openCode,
  onPick,
}: {
  rows: VisitedCountry[]
  openCode: string | null
  onPick: (code: string) => void
}) {
  const W = 1000
  const H = 500

  return (
    <div
      className="w-full overflow-hidden rounded-[2px] border"
      style={{ borderColor: 'var(--rule)', backgroundColor: 'rgba(92,70,48,0.04)' }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
        aria-label="World chart with your pinned countries">
        {CONTINENTS.map((outline, i) => (
          <polygon
            key={i}
            points={outline.map(([x, y]) => `${x * W},${y * H}`).join(' ')}
            fill="rgba(92,70,48,0.13)"
            stroke="rgba(92,70,48,0.34)"
            strokeWidth={0.8}
          />
        ))}

        {rows.map((row) => {
          const country = COUNTRIES.find((c) => c.code === row.countryCode)
          if (!country) return null
          const x = ((country.lon + 180) / 360) * W
          const y = ((90 - country.lat) / 180) * H
          const been = row.status === 'visited'
          const active = openCode === row.countryCode

          return (
            <g
              key={row.countryCode}
              onClick={() => onPick(row.countryCode)}
              style={{ cursor: 'pointer' }}
            >
              <title>{countryName(row.countryCode)}</title>
              {active && <circle cx={x} cy={y} r={11} fill="none" stroke="var(--brass)" strokeWidth={1.4} />}
              <circle
                cx={x}
                cy={y}
                r={5}
                // Been there is a filled pin; still to come is an empty one. The difference has
                // to survive being seen small, so it is fill, not hue.
                fill={been ? 'var(--oxblood)' : 'transparent'}
                stroke="var(--oxblood)"
                strokeWidth={1.6}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Every country, grouped by region, with what you have said about each. */
function CountryList({
  countries,
  byCode,
  openCode,
  onToggleOpen,
  onSetStatus,
  onPatched,
}: {
  countries: CountryRef[]
  byCode: Record<string, VisitedCountry>
  openCode: string | null
  onToggleOpen: (code: string) => void
  onSetStatus: (code: string, status: Status | null) => Promise<void>
  onPatched: (saved: VisitedCountry) => void
}) {
  return (
    <div className="space-y-7">
      {REGIONS.map((region) => {
        const inRegion = countries.filter((c) => c.region === region)
        if (inRegion.length === 0) return null

        return (
          <section key={region}>
            <p className="small-caps mb-2">{region}</p>
            <ul className="grid gap-x-10 md:grid-cols-2">
              {inRegion.map((country) => (
                <CountryRow
                  key={country.code}
                  country={country}
                  row={byCode[country.code]}
                  expanded={openCode === country.code}
                  onToggleOpen={() => onToggleOpen(country.code)}
                  onSetStatus={onSetStatus}
                  onPatched={onPatched}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function CountryRow({
  country,
  row,
  expanded,
  onToggleOpen,
  onSetStatus,
  onPatched,
}: {
  country: CountryRef
  row?: VisitedCountry
  expanded: boolean
  onToggleOpen: () => void
  onSetStatus: (code: string, status: Status | null) => Promise<void>
  onPatched: (saved: VisitedCountry) => void
}) {
  const status = row?.status as Status | undefined

  return (
    <li className="min-w-0 border-b" style={{ borderColor: 'var(--rule)' }}>
      <div className="flex items-center gap-3 py-2">
        <button
          onClick={onToggleOpen}
          disabled={!row}
          className="min-w-0 flex-1 truncate text-left text-[14px] disabled:cursor-default"
          style={{ color: row ? 'var(--ink)' : 'var(--ink-soft)' }}
        >
          {country.name}
        </button>

        <div className="flex shrink-0 gap-2">
          <StatusMark
            label="Been"
            on={status === 'visited'}
            onClick={() => onSetStatus(country.code, status === 'visited' ? null : 'visited')}
          />
          <StatusMark
            label="To come"
            on={status === 'future'}
            onClick={() => onSetStatus(country.code, status === 'future' ? null : 'future')}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && row && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <CountryNote row={row} onPatched={onPatched} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

/** A pin's own small label: a toggle that reads as marked or unmarked, not as a form control. */
function StatusMark({
  label,
  on,
  onClick,
}: {
  label: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="rounded-full border px-2.5 py-0.5 text-[11px] transition"
      style={{
        borderColor: on ? 'var(--brass)' : 'var(--rule)',
        color: on ? 'var(--ink)' : 'var(--ink-faint)',
        backgroundColor: on ? 'rgba(176,141,87,0.14)' : 'transparent',
      }}
    >
      {label}
    </button>
  )
}

/** When you were there, and anything you want to remember about it. */
function CountryNote({
  row,
  onPatched,
}: {
  row: VisitedCountry
  onPatched: (saved: VisitedCountry) => void
}) {
  const [notes, setNotes] = useState(row.notes ?? '')
  const [date, setDate] = useState(row.visitedDate ? row.visitedDate.slice(0, 10) : '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const touched = useRef(false)

  useEffect(() => {
    if (!touched.current) return
    setStatus('saving')
    const timer = setTimeout(async () => {
      try {
        const saved = await mapApi.upsert({
          countryCode: row.countryCode,
          status: row.status as Status,
          notes,
          visitedDate: date || undefined,
        })
        onPatched(saved)
        setStatus('saved')
      } catch {
        setStatus('failed')
      }
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, date, row.countryCode])

  return (
    <div className="pb-4 pl-1">
      <div className="mb-2 flex items-end gap-3">
        <label className="shrink-0">
          <span className="small-caps mb-1 block">When</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              touched.current = true
              setDate(e.target.value)
            }}
            className="ruled-field"
          />
        </label>
        <span className="pb-1 text-[11px] text-[var(--ink-faint)]">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'failed' ? 'Not saved' : ''}
        </span>
      </div>

      <textarea
        value={notes}
        onChange={(e) => {
          touched.current = true
          setNotes(e.target.value)
        }}
        placeholder="What you remember of it…"
        rows={3}
        className="w-full resize-none border-b border-transparent bg-transparent text-[14px] leading-relaxed text-[var(--ink-soft)] outline-none transition placeholder:text-[var(--ink-faint)] placeholder:italic focus:border-[var(--rule)]"
        style={{ overflowWrap: 'anywhere' }}
      />
    </div>
  )
}
