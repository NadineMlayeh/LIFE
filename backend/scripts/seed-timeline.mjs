// Dev helper: fills an account's timeline with dummy events so search, sorting and the gap
// tooltips can be tested at realistic volume.
//   node scripts/seed-timeline.mjs you@example.com
// Remove them again with:
//   node scripts/seed-timeline.mjs you@example.com --clear
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TITLES = [
  'Started school', 'Moved house', 'First bike', 'Family trip to the coast',
  'Won a chess match', 'Broke my arm', 'Adopted a cat', 'First concert',
  'Started learning guitar', 'Summer job', 'Graduated high school',
  'First day at university', 'Failed an exam', 'Passed the resit',
  'Internship interview', 'Started the internship', 'Built my first website',
  'Trip to Rome', 'Learned to drive', 'First paycheck', 'Moved to a new city',
  'Ran a 10k', 'Started a side project', 'Gave a conference talk',
  'Read 30 books in a year', 'Camping in the mountains', 'Lost my phone',
  'Started therapy', 'Quit social media for a month', 'Cooked for 20 people',
]

const DESCRIPTIONS = [
  'Still remember the weather that day.',
  'Harder than expected, worth it anyway.',
  'One of those days that changed the direction of things.',
  '',
  'Would do it again.',
]

const GOALS = [
  'Learn Spanish', 'Run a half marathon', 'Ship LIFE v1', 'Visit Japan',
  'Read 50 books', 'Get scuba certified',
]

const email = process.argv[2]
const clear = process.argv.includes('--clear')

if (!email) {
  console.error('Usage: node scripts/seed-timeline.mjs <email> [--clear]')
  process.exit(1)
}

const user = await prisma.user.findUnique({ where: { email } })
if (!user) {
  console.error(`No account found for ${email}`)
  process.exit(1)
}

if (clear) {
  const { count } = await prisma.timelineEvent.deleteMany({
    where: { userId: user.id, type: 'dummy' },
  })
  console.log(`Removed ${count} dummy events from ${email}`)
  await prisma.$disconnect()
  process.exit(0)
}

const events = []

TITLES.forEach((title, index) => {
  const year = 2004 + Math.floor(index * 0.7)
  const month = (index * 5) % 12
  const day = ((index * 7) % 27) + 1
  events.push({
    userId: user.id,
    title,
    date: new Date(Date.UTC(year, month, day)),
    description: DESCRIPTIONS[index % DESCRIPTIONS.length] || null,
    type: 'dummy',
    isGoal: false,
  })
})

// A couple of goals whose date has already passed, so the "did you accomplish this?" prompt
// has something to ask about immediately.
GOALS.forEach((title, index) => {
  const overdue = index < 2
  const date = overdue
    ? new Date(Date.now() - (index + 1) * 30 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + (index + 1) * 120 * 24 * 60 * 60 * 1000)

  events.push({
    userId: user.id,
    title,
    date,
    description: null,
    type: 'dummy',
    isGoal: true,
    goalStatus: 'PENDING',
  })
})

// A few extra past events so the total comfortably clears 50.
for (let i = 0; i < 20; i += 1) {
  events.push({
    userId: user.id,
    title: `Ordinary day #${i + 1}`,
    date: new Date(Date.UTC(2015 + (i % 10), i % 12, ((i * 3) % 27) + 1)),
    description: null,
    type: 'dummy',
    isGoal: false,
  })
}

await prisma.timelineEvent.createMany({ data: events })
console.log(`Added ${events.length} dummy events to ${email}`)

const total = await prisma.timelineEvent.count({ where: { userId: user.id } })
console.log(`Timeline now has ${total} events in total`)

await prisma.$disconnect()
