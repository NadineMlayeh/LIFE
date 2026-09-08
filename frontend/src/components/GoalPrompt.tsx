import { useState } from 'react'
import { timelineApi } from '../services/lifeApi'
import type { TimelineEvent } from '../types'
import { formatEventDate } from '../utils/dates'

// Goals are checked when the timeline loads rather than pushed at you — no notification
// system, per spec C.3.8.
export function GoalPrompt({
  goals,
  onResolved,
}: {
  goals: TimelineEvent[]
  onResolved: () => Promise<void>
}) {
  if (goals.length === 0) return null

  return (
    <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-medium text-amber-900">
        {goals.length === 1
          ? 'A goal has reached its date.'
          : `${goals.length} goals have reached their date.`}
      </h2>
      {goals.map((goal) => (
        <GoalRow key={goal.id} goal={goal} onResolved={onResolved} />
      ))}
    </section>
  )
}

function GoalRow({ goal, onResolved }: { goal: TimelineEvent; onResolved: () => Promise<void> }) {
  const [rescheduling, setRescheduling] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [busy, setBusy] = useState(false)

  async function resolve(goalStatus: 'ACHIEVED' | 'NOT_ACHIEVED') {
    setBusy(true)
    try {
      await timelineApi.update(goal.id, { goalStatus })
      await onResolved()
    } finally {
      setBusy(false)
    }
  }

  async function reschedule() {
    if (!newDate) return
    setBusy(true)
    try {
      await timelineApi.update(goal.id, {
        date: new Date(newDate).toISOString(),
        goalStatus: 'PENDING',
      })
      await onResolved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded border border-amber-200 bg-white p-3">
      <p className="font-medium text-neutral-900">🎯 {goal.title}</p>
      <p className="text-xs text-neutral-500">Was set for {formatEventDate(goal.date)}</p>

      {rescheduling ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button
            onClick={reschedule}
            disabled={busy || !newDate}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            Save new date
          </button>
          <button
            onClick={() => setRescheduling(false)}
            className="text-sm text-neutral-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-600">Did you accomplish this?</span>
          <button
            onClick={() => resolve('ACHIEVED')}
            disabled={busy}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            Yes
          </button>
          <button
            onClick={() => resolve('NOT_ACHIEVED')}
            disabled={busy}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Not yet
          </button>
          <button
            onClick={() => setRescheduling(true)}
            disabled={busy}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Reschedule
          </button>
        </div>
      )}
    </div>
  )
}
