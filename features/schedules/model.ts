export interface Schedule {
  id: string
  xiaomiAccountId: string
  accountNickname: string
  cronExpression: string
  minStep: number
  maxStep: number
  isActive: boolean
  lastRunAt: string | null
  nextRunAt: string | null
}

export interface ScheduleFormValue {
  xiaomiAccountId: string
  hour: number
  minute: number
  days: string[]
  minStep: number
  maxStep: number
}

export const DEFAULT_SCHEDULE_FORM: ScheduleFormValue = {
  xiaomiAccountId: '',
  hour: 9,
  minute: 0,
  days: ['1', '2', '3', '4', '5'],
  minStep: 1000,
  maxStep: 1500,
}

export function parseCron(cron: string): Pick<ScheduleFormValue, 'hour' | 'minute' | 'days'> {
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return { hour: 9, minute: 0, days: ['1', '2', '3', '4', '5'] }
  const [minute, hour, , , dow] = parts
  let days: string[]
  if (dow === '*') {
    days = ['1', '2', '3', '4', '5', '6', '0']
  } else if (dow.includes('-')) {
    const [start, end] = dow.split('-').map(Number)
    days = []
    for (let day = start; day <= end; day++) days.push(String(day))
  } else {
    days = dow.split(',')
  }
  return {
    hour: hour !== '*' ? Number(hour) : 9,
    minute: minute !== '*' ? Number(minute) : 0,
    days,
  }
}

export function buildCronExpression(form: ScheduleFormValue): string {
  const sorted = [...form.days].sort((a, b) => Number(a) - Number(b))
  const dayOfWeek = sorted.length === 7
    ? '*'
    : sorted.length === 5 && sorted.join(',') === '1,2,3,4,5'
      ? '1-5'
      : sorted.join(',')
  return `${form.minute} ${form.hour} * * ${dayOfWeek}`
}

export function cronSortKey(cron: string): number {
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return 0
  const minute = parts[0] !== '*' ? Number(parts[0]) : 0
  const hour = parts[1] !== '*' ? Number(parts[1]) : 0
  return hour * 60 + minute
}

export function cronToHuman(
  cron: string,
  translate: (key: string, params?: Record<string, string | number>) => string,
): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return cron
  const [minute, hour, , , dow] = parts
  const hh = hour !== '*' ? hour.padStart(2, '0') : null
  const mm = minute !== '*' ? minute.padStart(2, '0') : '00'
  const time = hh ? `${hh}:${mm}` : translate('cronEveryHour')
  const dayKeys = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat']

  const formatDayOfWeek = (value: string): string => {
    if (value === '*') return translate('cronEveryDay')
    if (value === '1-5') return translate('cronWeekday')
    if (value === '1-6') return translate('cronMonToSat')
    if (value === '0-6' || value === '0,1,2,3,4,5,6') return translate('cronEveryDay')
    if (!value.includes(',') && !value.includes('-')) {
      return `${translate('cronDayPrefix')}${translate(dayKeys[Number(value) % 7])}`
    }

    const days: number[] = []
    for (const segment of value.split(',')) {
      if (segment.includes('-')) {
        const [start, end] = segment.split('-').map(Number)
        for (let day = start; day <= end; day++) days.push(day)
      } else {
        days.push(Number(segment))
      }
    }

    const sorted = [...days].sort((a, b) => a - b)
    const consecutive = sorted.length >= 3 && sorted.every(
      (day, index) => index === 0 || day === sorted[index - 1] + 1,
    )
    if (consecutive) {
      return `${translate('cronDayPrefix')}${translate(dayKeys[sorted[0] % 7])} ${translate('cronDayRange', {
        start: translate(dayKeys[sorted[0] % 7]),
        end: translate(dayKeys[sorted[sorted.length - 1] % 7]),
      })}`
    }

    return `${translate('cronDayPrefix')}${sorted
      .sort((a, b) => (a % 7) - (b % 7))
      .map((day) => translate(dayKeys[day % 7]))
      .join(', ')}`
  }

  const dayOfWeek = formatDayOfWeek(dow)
  if (!hh) return `${dayOfWeek}, ${translate('cronEveryHourExec')}`
  return `${dayOfWeek} ${time}`
}
