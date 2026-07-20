const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000

interface CronFields {
  minute: number
  hour: number
  dayOfMonth: number
  month: number
  dayOfWeek: number
}

function getShanghaiFields(date: Date): CronFields {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS)
  return {
    minute: shifted.getUTCMinutes(),
    hour: shifted.getUTCHours(),
    dayOfMonth: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    dayOfWeek: shifted.getUTCDay(),
  }
}

function matchesCronField(field: string, current: number, aliases: number[] = []): boolean {
  const candidates = [current, ...aliases]
  if (field === '*') return true
  if (candidates.some((candidate) => field === String(candidate))) return true

  if (field.startsWith('*/')) {
    const step = Number(field.slice(2))
    return Number.isInteger(step) && step > 0 && current % step === 0
  }

  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number)
    return candidates.some((candidate) => candidate >= start && candidate <= end)
  }

  if (field.includes(',')) {
    const values = field.split(',').map(Number)
    return candidates.some((candidate) => values.includes(candidate))
  }

  return false
}

export function matchesCronExpression(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  const current = getShanghaiFields(date)

  return (
    matchesCronField(minute, current.minute) &&
    matchesCronField(hour, current.hour) &&
    matchesCronField(dayOfMonth, current.dayOfMonth) &&
    matchesCronField(month, current.month) &&
    matchesCronField(dayOfWeek, current.dayOfWeek, current.dayOfWeek === 0 ? [7] : [])
  )
}

export function minuteStart(date: Date): Date {
  const result = new Date(date)
  result.setSeconds(0, 0)
  return result
}

export function getNextCronOccurrence(expression: string, after: Date): Date | null {
  const candidate = minuteStart(new Date(after.getTime() + 60_000))
  const maxIterations = 366 * 24 * 60

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (matchesCronExpression(expression, candidate)) return new Date(candidate)
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)
  }

  return null
}
