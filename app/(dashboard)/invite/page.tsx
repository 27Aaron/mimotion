'use client'

import { useState, useEffect } from 'react'
import { IconPlus, IconTrash, IconCopy, IconTicket } from '@tabler/icons-react'

interface InviteCode {
  code: string
  usedBy: string | null
  createdAt: string
}

export default function InvitePage() {
  const [codes, setCodes] = useState<InviteCode[]>([])
  const [newCode, setNewCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchCodes() }, [])

  async function fetchCodes() {
    const res = await fetch('/api/invite')
    if (res.ok) setCodes(await res.json())
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
    if (!confirm('确定删除该邀请码？')) return
    await fetch(`/api/invite?code=${code}`, { method: 'DELETE' })
    fetchCodes()
  }

  return (
    <div>
      <div className="page-header">
        <h1>邀请码管理</h1>
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
          <IconPlus size={16} stroke={2} /> {loading ? '生成中...' : '生成邀请码'}
        </button>
      </div>

      {newCode && (
        <div className="code-highlight">
          <code>{newCode}</code>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { navigator.clipboard.writeText(newCode) }}
          >
            <IconCopy size={14} stroke={1.5} /> 复制
          </button>
        </div>
      )}

      {codes.length === 0 ? (
        <div className="empty-state">
          <IconTicket size={40} stroke={1} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
          <div>暂无邀请码</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>邀请码</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.code}>
                  <td>
                    <code style={{ fontSize: '0.9rem' }}>{c.code}</code>
                  </td>
                  <td>
                    <span className={`badge ${c.usedBy ? 'badge-success' : 'badge-neutral'}`}>
                      {c.usedBy ? '已使用' : '未使用'}
                    </span>
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                    {new Date(c.createdAt).toLocaleString()}
                  </td>
                  <td>
                    {!c.usedBy && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.code)}>
                        <IconTrash size={14} stroke={1.5} /> 删除
                      </button>
                    )}
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
