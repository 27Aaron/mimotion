'use client'

import { useState } from 'react'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [barkUrl, setBarkUrl] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)

    const res = await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email || undefined,
        password: newPassword || undefined,
        currentPassword: currentPassword || undefined,
        barkUrl: barkUrl || null,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setMessage('设置已保存')
      setCurrentPassword('')
      setNewPassword('')
    } else {
      setError(data.error || '保存失败')
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>设置</h1>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 20 }}>账号信息</h2>
          <div>
            <label>新邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="留空则不修改"
            />
          </div>
          <div>
            <label>当前密码（修改密码时必填）</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="输入当前密码"
            />
          </div>
          <div>
            <label>新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码"
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 20 }}>通知设置</h2>
          <div>
            <label>Bark 推送 URL</label>
            <input
              type="url"
              value={barkUrl}
              onChange={(e) => setBarkUrl(e.target.value)}
              placeholder="https://api.day.app（留空使用默认）"
            />
          </div>
        </div>

        {error && <div className="msg-error" style={{ marginBottom: 16 }}>{error}</div>}
        {message && <div className="msg-success" style={{ marginBottom: 16 }}>{message}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? '保存中...' : '保存设置'}
        </button>
      </form>
    </div>
  )
}
