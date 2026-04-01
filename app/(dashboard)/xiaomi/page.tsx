'use client'

import { useState, useEffect } from 'react'

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

  useEffect(() => {
    fetchAccounts()
  }, [])

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

    const res = await fetch('/api/xiaomi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (res.ok) {
      setShowAdd(false)
      setForm({ account: '', password: '', nickname: '' })
      fetchAccounts()
    } else {
      setError(data.error || '添加失败')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除？')) return

    await fetch(`/api/xiaomi?id=${id}`, { method: 'DELETE' })
    fetchAccounts()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>小米账号</h1>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 16px' }}>
          添加账号
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
          <div style={{ background: 'white', padding: 24, borderRadius: 8, width: 400 }}>
            <h2>添加小米账号</h2>
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: 16 }}>
                <label>小米账号（手机号/邮箱）</label>
                <input
                  type="text"
                  value={form.account}
                  onChange={(e) => setForm({ ...form, account: e.target.value })}
                  required
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label>密码</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label>显示名称（可选）</label>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </div>
              {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" style={{ padding: '8px 16px' }}>
                  添加
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  style={{ padding: '8px 16px' }}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <p style={{ marginTop: 20 }}>暂无账号</p>
      ) : (
        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th>名称</th>
              <th>状态</th>
              <th>最后同步</th>
              <th>最后错误</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{acc.nickname}</td>
                <td>
                  <span style={{ color: acc.status === 'active' ? 'green' : 'red' }}>
                    {acc.status === 'active' ? '正常' : '异常'}
                  </span>
                </td>
                <td>{acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleString() : '-'}</td>
                <td>{acc.lastError || '-'}</td>
                <td>
                  <button onClick={() => handleDelete(acc.id)} style={{ color: 'red' }}>
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