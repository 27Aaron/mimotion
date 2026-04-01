import { db } from './db'
import { users } from './db/schema'
import { eq } from 'drizzle-orm'

interface BarkPushOptions {
  userId: string
  title: string
  body: string
  sound?: string
}

async function getBarkUrl(userId: string): Promise<string> {
  const result = await db
    .select({ barkUrl: users.barkUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (result[0]?.barkUrl) {
    return result[0].barkUrl
  }
  return process.env.BARK_URL || 'https://api.day.app'
}

export async function sendBarkPush(options: BarkPushOptions): Promise<boolean> {
  const barkUrl = await getBarkUrl(options.userId)
  const url = `${barkUrl}/push`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: options.title,
        body: options.body,
        sound: options.sound || 'alarm',
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Bark push failed:', error)
    return false
  }
}
