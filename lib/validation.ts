import cron from 'node-cron'

const CRON_FIELD_PATTERN = /^(\*|\*\/\d+|\d+|\d+-\d+|\d+(,\d+)+)$/

export function normalizeCronExpression(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ')
  if (parts.length !== 5) return null
  if (!parts.every((part) => CRON_FIELD_PATTERN.test(part))) return null
  return cron.validate(normalized) ? normalized : null
}

export function isNullableString(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= maxLength)
}
