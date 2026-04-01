'use client'

import { useState, useEffect } from 'react'

interface InviteCode {
  code: string
  usedBy: string | null
  createdAt: string
}

export default function InvitePage() {
  const [codes, setCodes] = useState<InviteCode[]>([])
  const [newCode, setNewCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCodes()
  }, [])

  async function fetchCodes() {
    const res = await fetch('/api/invite')
    if (res.ok) {
      const data = await res.json()
      setCodes(data)
    }
  }

  async function handleCreate() {
    setLoading(true)
    const res = await fetch('/api/invite', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setNewCode(data.code)
      fetchCodes()
    }
    setLoading(false)
  }

  async function handleDelete(code: string) {
    if (!confirm('确定删除？')) return
    await fetch(`/api/invite?code=${code}`, { method: 'DELETE' })
    fetchCodes()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>邀请码管理</h1>
        <button onClick={handleCreate} disabled={loading} style={{ padding: '8px 16px' }}>
          {loading ? '生成中...' : '生成邀请码'}
        </button>
      </div>

      {newCode && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: '#e8f5e9',
            borderRadius: 8,
            wordBreak: 'break-all',
          }}
        >
          <p style={{ margin: 0 }}>新邀请码：</p>
          <code style={{ fontSize: 18 }}>{newCode}</code>
          <button
            onClick={() => navigator.clipboard.writeText(newCode)}
            style={{ marginLeft: 12 }}
          >
            复制
          </button>
        </div>
      )}

      {codes.length === 0 ? (
        <p style={{ marginTop: 20 }}>暂无邀请码</p>
      ) : (
        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th>邀请码</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.code} style={{ borderBottom: '1px solid #eee' }}>
                <td>
                  <code>{c.code}</code>
                </td>
                <td>
                  <span style={{ color: c.usedBy ? 'green' : '#666' }}>
                    {c.usedBy ? '已使用' : '未使用'}
                  </span>
                </td>
                <td>{new Date(c.createdAt).toLocaleString()}</td>
                <td>
                  {!c.usedBy && (
                    <button onClick={() => handleDelete(c.code)} style={{ color: 'red' }}>
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}