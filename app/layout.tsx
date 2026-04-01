import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'mimotion',
  description: '小米运动自动刷步数',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
