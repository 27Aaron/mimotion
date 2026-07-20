import type { ZodError } from 'zod'

export function isNullableString(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= maxLength)
}

export function validationMessage(error: ZodError): string {
  return error.issues[0]?.message || '请求参数无效'
}
