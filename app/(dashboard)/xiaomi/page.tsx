'use client'

import { useState, useEffect } from 'react'
import { IconPlus, IconTrash, IconDeviceMobile } from '@tabler/icons-react'

interface Account {
  id: string
  nickname: string
  status: string
  lastSyncAt: string | null
  lastError: string | null
}

export default function XiaomiPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ account: '', password: '', nickname: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchAccounts() }, [])

  async function fetchAccounts() {
    const res = await fetch('/api/xiaomi')
    if (res.ok) setAccounts(await res.json())
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/xiaomi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setShowAdd(false)
      setForm({ account: '', password: '', nickname: '' })
      fetchAccounts()
    } else {
      setError(data.error || '添加失败')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该账号？')) return
    await fetch(`/api/xiaomi?id=${id}`, { method: 'DELETE' })
    fetchAccounts()
  }

  return (
    <div>
      <div className="page-header">
        <h1>小米账号</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <IconPlus size={16} stroke={2} /> 添加账号
        </button>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>添加小米账号</h2>
            <form onSubmit={handleAdd}>
              <div>
                <label>小米账号（手机号 / 邮箱）</label>
                <input
                  type="text"
                  value={form.account}
                  onChange={(e) => setForm({ ...form, account: e.target.value })}
                  placeholder="手机号或邮箱"
                  required
                />
              </div>
              <div>
                <label>密码</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="小米账号密码"
                  required
                />
              </div>
              <div>
                <label>显示名称（可选）</label>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  placeholder="给账号起个名字"
                />
              </div>
              {error && <div className="msg-error" style={{ marginTop: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '添加中...' : '添加'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="empty-state">
          <IconDeviceMobile size={40} stroke={1} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
          <div>暂无账号，点击上方按钮添加</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>状态</th>
                <th>最后同步</th>
                <th>错误信息</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{acc.nickname}</td>
                  <td>
                    <span className={`badge ${acc.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {acc.status === 'active' ? '正常' : '异常'}
                    </span>
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                    {acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleString() : '-'}
                  </td>
                  <td>{acc.lastError || '-'}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(acc.id)}>
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
