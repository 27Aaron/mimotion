'use client'

import { useState, useEffect } from 'react'
import {
  IconPlus,
  IconTrash,
  IconClock,
  IconPlayerPause,
  IconPlayerPlay,
} from '@tabler/icons-react'

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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSchedules()
    fetchAccounts()
  }, [])

  async function fetchSchedules() {
    const res = await fetch('/api/schedules')
    if (res.ok) setSchedules(await res.json())
  }

  async function fetchAccounts() {
    const res = await fetch('/api/xiaomi')
    if (res.ok) setAccounts(await res.json())
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setShowAdd(false)
      setForm({ xiaomiAccountId: '', cronExpression: '0 9 * * *', minStep: 1000, maxStep: 1500 })
      fetchSchedules()
    } else {
      setError(data.error || '创建失败')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该任务？')) return
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
      <div className="page-header">
        <h1>定时任务</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <IconPlus size={16} stroke={2} /> 创建任务
        </button>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>创建定时任务</h2>
            <form onSubmit={handleAdd}>
              <div>
                <label>小米账号</label>
                <select
                  value={form.xiaomiAccountId}
                  onChange={(e) => setForm({ ...form, xiaomiAccountId: e.target.value })}
                  required
                >
                  <option value="">选择账号</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.nickname}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Cron 表达式</label>
                <input
                  type="text"
                  value={form.cronExpression}
                  onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                  placeholder="0 9 * * *"
                  required
                />
                <div className="cron-hint">
                  例: 0 9 * * * = 每天9点 &nbsp;|&nbsp; 0 12 * * * = 每天12点
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>最小步数</label>
                  <input
                    type="number"
                    value={form.minStep}
                    onChange={(e) => setForm({ ...form, minStep: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>最大步数</label>
                  <input
                    type="number"
                    value={form.maxStep}
                    onChange={(e) => setForm({ ...form, maxStep: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>
              {error && <div className="msg-error" style={{ marginTop: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '创建中...' : '创建'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="empty-state">
          <IconClock size={40} stroke={1} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
          <div>暂无任务，点击上方按钮创建</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>账号</th>
                <th>Cron</th>
                <th>步数范围</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{s.accountNickname}</td>
                  <td>
                    <code style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.cronExpression}</code>
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                    {s.minStep.toLocaleString()} - {s.maxStep.toLocaleString()}
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${s.isActive ? 'badge-success' : 'badge-neutral'}`}
                      style={{ border: 'none', cursor: 'pointer', font: 'inherit' }}
                      onClick={() => handleToggle(s.id, s.isActive)}
                    >
                      {s.isActive
                        ? <><IconPlayerPause size={12} stroke={1.5} /> 运行中</>
                        : <><IconPlayerPlay size={12} stroke={1.5} /> 已停用</>
                      }
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>
                      <IconTrash size={14} stroke={1.5} /> 删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
