import { db } from './db'
import { users } from './db/schema'
import { eq } from 'drizzle-orm'

interface TelegramPushOptions {
  userId: string
  title: string
  body: string
}

async function getTelegramConfig(userId: string): Promise<{ botToken: string; chatId: string } | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return null

  const result = await db
    .select({ telegramChatId: users.telegramChatId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const chatId = result[0]?.telegramChatId
  if (!chatId) return null

  return { botToken, chatId }
}

export async function sendTelegramPush(options: TelegramPushOptions): Promise<boolean> {
  const config = await getTelegramConfig(options.userId)
  if (!config) return false

  const text = `*${escapeMarkdown(options.title)}*\n${escapeMarkdown(options.body)}`

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          parse_mode: 'Markdown',
        }),
      },
    )

    return response.ok
  } catch (error) {
    console.error('Telegram push failed:', error)
    return false
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}
