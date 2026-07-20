export interface XiaomiAccount {
  id: string
  nickname: string
  account: string | null
  status: 'active' | 'error'
  lastSyncAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
  scheduleCount: number
  activeScheduleCount: number
  lastStep: number | null
}

export interface XiaomiAccountInput {
  account: string
  password: string
  nickname?: string
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((data as { error?: string }).error || '请求失败')
  return data as T
}

export function listXiaomiAccounts(): Promise<XiaomiAccount[]> {
  return jsonRequest('/api/xiaomi')
}

export function createXiaomiAccount(input: XiaomiAccountInput) {
  return jsonRequest('/api/xiaomi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateXiaomiAccount(id: string, input: Partial<XiaomiAccountInput>) {
  return jsonRequest(`/api/xiaomi?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteXiaomiAccount(id: string) {
  return jsonRequest(`/api/xiaomi?id=${id}`, { method: 'DELETE' })
}
