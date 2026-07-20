import type { Schedule, ScheduleFormValue } from './model'
import { buildCronExpression } from './model'

export interface XiaomiAccountOption {
  id: string
  nickname: string
  account: string
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || '请求失败')
  }
  return data as T
}

export function listSchedules(): Promise<Schedule[]> {
  return jsonRequest('/api/schedules')
}

export function listXiaomiAccounts(): Promise<XiaomiAccountOption[]> {
  return jsonRequest('/api/xiaomi')
}

export function createSchedule(value: ScheduleFormValue): Promise<{ id: string }> {
  return jsonRequest('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      xiaomiAccountId: value.xiaomiAccountId,
      cronExpression: buildCronExpression(value),
      minStep: value.minStep,
      maxStep: value.maxStep,
    }),
  })
}

export function updateSchedule(id: string, value: Partial<ScheduleFormValue> & { isActive?: boolean }) {
  const body: Record<string, unknown> = { ...value }
  if (value.days) body.cronExpression = buildCronExpression(value as ScheduleFormValue)
  delete body.hour
  delete body.minute
  delete body.days
  return jsonRequest(`/api/schedules?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteSchedule(id: string) {
  return jsonRequest(`/api/schedules?id=${id}`, { method: 'DELETE' })
}
