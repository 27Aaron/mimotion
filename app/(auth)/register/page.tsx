'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, inviteCode }),
    })

    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError(data.error || '注册失败')
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.glow} />
      <div style={styles.grid} />

      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.logo}>m</div>
          <div>
            <div style={styles.brandName}>mimotion</div>
            <div style={styles.brandTagline}>创建新账号</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="设置密码"
              required
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>邀请码</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="输入邀请码"
              required
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              ...(loading ? styles.submitBtnLoading : {}),
            }}
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div style={styles.footer}>
          已有账号？<a href="/login" style={styles.link}>登录</a>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#08090d',
    position: 'relative',
    overflow: 'hidden',
  },

  glow: {
    position: 'absolute',
    top: '-30%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 600,
    height: 600,
    background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },

  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(30,32,40,0.4) 1px, transparent 1px),
      linear-gradient(90deg, rgba(30,32,40,0.4) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px',
    pointerEvents: 'none',
    maskImage: 'radial-gradient(ellipse 60% 60% at 50% 40%, black 20%, transparent 70%)',
    WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 40%, black 20%, transparent 70%)',
  },

  card: {
    width: 380,
    maxWidth: '90vw',
    padding: '40px 36px',
    background: 'rgba(17, 19, 24, 0.8)',
    border: '1px solid rgba(42, 45, 56, 0.6)',
    borderRadius: 16,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    position: 'relative',
    zIndex: 1,
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
  },

  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 36,
  },

  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #10b981, #059669)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },

  brandName: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 18,
    fontWeight: 700,
    color: '#e4e4e7',
    letterSpacing: '-0.02em',
  },

  brandTagline: {
    fontSize: 12,
    color: '#52546a',
    marginTop: 2,
    letterSpacing: '0.04em',
  },

  field: {
    marginBottom: 20,
  },

  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#8b8d98',
    marginBottom: 6,
    letterSpacing: '0.02em',
  },

  input: {
    width: '100%',
    padding: '11px 14px',
    background: '#08090d',
    border: '1px solid #2a2d38',
    borderRadius: 8,
    color: '#e4e4e7',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },

  error: {
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.1)',
    color: '#ef4444',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 16,
  },

  submitBtn: {
    width: '100%',
    padding: '12px 0',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    marginTop: 4,
  },

  submitBtnLoading: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },

  footer: {
    textAlign: 'center' as const,
    marginTop: 24,
    color: '#52546a',
    fontSize: 13,
  },

  link: {
    color: '#10b981',
    textDecoration: 'none',
    fontWeight: 500,
  },
}
