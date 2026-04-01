'use client'

import { useState, useEffect } from 'react'

interface Schedule {
  id: string
  xiaomiAccountId: string
  accountNickname: string
  cronExpression: string
  minStep: number
  maxStep: number
  isActive: boolean
  lastRunAt: string | null
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [accounts, setAccounts] = useState<{ id: string; nickname: string }[]>([])
  const [form, setForm] = useState({
    xiaomiAccountId: '',
    cronExpression: '0 9 * * *',
    minStep: 1000,
    maxStep: 1500,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSchedules()
    fetchAccounts()
  }, [])

  async function fetchSchedules() {
    const res = await fetch('/api/schedules')
    if (res.ok) {
      const data = await res.json()
      setSchedules(data)
    }
  }

  async function fetchAccounts() {
    const res = await fetch('/api/xiaomi')
    if (res.ok) {
      const data = await res.json()
      setAccounts(data)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (res.ok) {
      setShowAdd(false)
      setForm({ xiaomiAccountId: '', cronExpression: '0 9 * * *', minStep: 1000, maxStep: 1500 })
      fetchSchedules()
    } else {
      setError(data.error || '创建失败')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除？')) return
    await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' })
    fetchSchedules()
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/schedules?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    fetchSchedules()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>定时任务</h1>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 16px' }}>
          创建任务
        </button>
      </div>

      {showAdd && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ background: 'white', padding: 24, borderRadius: 8, width: 450 }}>
            <h2>创建定时任务</h2>
            <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Cron 表达式示例: 0 9 * * * = 每天9点, 0 12 * * * = 每天12点
            </p>
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: 16 }}>
                <label>小米账号</label>
                <select
                  value={form.xiaomiAccountId}
                  onChange={(e) => setForm({ ...form, xiaomiAccountId: e.target.value })}
                  required
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                >
                  <option value="">选择账号</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nickname}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label>Cron 表达式</label>
                <input
                  type="text"
                  value={form.cronExpression}
                  onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                  required
                  placeholder="0 9 * * *"
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>最小步数</label>
                  <input
                    type="number"
                    value={form.minStep}
                    onChange={(e) => setForm({ ...form, minStep: parseInt(e.target.value) })}
                    required
                    style={{ width: '100%', padding: 8, marginTop: 4 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>最大步数</label>
                  <input
                    type="number"
                    value={form.maxStep}
                    onChange={(e) => setForm({ ...form, maxStep: parseInt(e.target.value) })}
                    required
                    style={{ width: '100%', padding: 8, marginTop: 4 }}
                  />
                </div>
              </div>
              {error && <div style={{ color: 'red', margin: '16px 0' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" style={{ padding: '8px 16px' }}>
                  创建
                </button>
                <button type="button" onClick={() => setShowAdd(false)} style={{ padding: '8px 16px' }}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <p style={{ marginTop: 20 }}>暂无任务</p>
      ) : (
        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th>账号</th>
              <th>时间</th>
              <th>步数范围</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{s.accountNickname}</td>
                <td>{s.cronExpression}</td>
                <td>
                  {s.minStep} - {s.maxStep}
                </td>
                <td>
                  <button onClick={() => handleToggle(s.id, s.isActive)}>
                    {s.isActive ? '停用' : '启用'}
                  </button>
                </td>
                <td>
                  <button onClick={() => handleDelete(s.id)} style={{ color: 'red' }}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}