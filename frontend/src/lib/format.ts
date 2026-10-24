const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

function formatLocalTime(date: Date): string {
  const hours24 = date.getHours()
  const minutes = date.getMinutes()
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const paddedMinutes = String(minutes).padStart(2, '0')
  return `${hours12}:${paddedMinutes} ${period}`
}

export function formatWhen(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  )

  let dayPart: string
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    dayPart = 'Today'
  } else if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    dayPart = 'Yesterday'
  } else {
    dayPart = `${MONTHS[date.getMonth()]} ${date.getDate()}`
  }

  return `${dayPart} · ${formatLocalTime(date)}`
}

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning.'
  if (hour < 18) return 'Good afternoon.'
  return 'Good evening.'
}

export function formatPercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export function capitalizeLabel(label: string): string {
  if (!label) return 'Pothole'
  return label.charAt(0).toUpperCase() + label.slice(1)
}
