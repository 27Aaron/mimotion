import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await request.json()
  const { type, barkUrl, telegramBotToken, telegramChatId } = body

  if (type === 'bark') {
    if (!barkUrl) {
      return NextResponse.json({ error: '请先填写 Bark URL' }, { status: 400 })
    }
    try {
      const res = await fetch(barkUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'MiMotion 测试推送',
          body: '如果你看到这条消息，说明 Bark 推送配置成功！',
          sound: 'alarm',
        }),
      })
      if (!res.ok) {
        return NextResponse.json({ error: `推送失败: HTTP ${res.status}` }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: 'Bark 测试推送已发送' })
    } catch {
      return NextResponse.json({ error: '推送请求失败，请检查 URL 是否正确' }, { status: 400 })
    }
  }

  if (type === 'telegram') {
    if (!telegramBotToken || !telegramChatId) {
      return NextResponse.json({ error: '请先填写 Bot Token 和 Chat ID' }, { status: 400 })
    }
    const text = '*MiMotion 测试推送*\n如果你看到这条消息，说明 Telegram 推送配置成功！'
    const escaped = text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: escaped,
            parse_mode: 'Markdown',
          }),
        },
      )
      const data = await res.json()
      if (!data.ok) {
        return NextResponse.json({ error: `推送失败: ${data.description || '未知错误'}` }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: 'Telegram 测试推送已发送' })
    } catch {
      return NextResponse.json({ error: '推送请求失败，请检查配置是否正确' }, { status: 400 })
    }
  }

  return NextResponse.json({ error: '未知的推送类型' }, { status: 400 })
}
