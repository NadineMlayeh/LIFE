export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function describeGap(earlierIso: string, laterIso: string): string {
  const earlier = new Date(earlierIso)
  const later = new Date(laterIso)

  let years = later.getFullYear() - earlier.getFullYear()
  let months = later.getMonth() - earlier.getMonth()
  let days = later.getDate() - earlier.getDate()

  if (days < 0) {
    months -= 1
    days += new Date(later.getFullYear(), later.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts: string[] = []
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`)
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`)
  if (parts.length === 0) {
    if (days <= 0) return 'same day'
    parts.push(`${days} day${days === 1 ? '' : 's'}`)
  }

  return `${parts.join(', ')} apart`
}
