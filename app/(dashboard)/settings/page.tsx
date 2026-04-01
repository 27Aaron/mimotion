'use client'

import { useState } from 'react'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [barkUrl, setBarkUrl] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')

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
      <h1>设置</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: 16 }}>
          <label>新邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>当前密码（修改密码时必填）</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Bark URL（留空使用默认）</label>
          <input
            type="url"
            value={barkUrl}
            onChange={(e) => setBarkUrl(e.target.value)}
            placeholder="https://api.day.app"
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>

        {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
        {message && <div style={{ color: 'green', marginBottom: 16 }}>{message}</div>}

        <button type="submit" style={{ padding: '8px 24px' }}>
          保存
        </button>
      </form>
    </div>
  )
}