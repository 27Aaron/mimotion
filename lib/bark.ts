import { db } from './db'
import { users } from './db/schema'
import { eq } from 'drizzle-orm'

interface BarkPushOptions {
  userId: string
  title: string
  body: string
}

async function getBarkUrl(userId: string): Promise<string | null> {
  const result = await db
    .select({ barkUrl: users.barkUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return result[0]?.barkUrl || null
}

export async function sendBarkPush(options: BarkPushOptions): Promise<boolean> {
  const barkUrl = await getBarkUrl(options.userId)
  if (!barkUrl) return false

  if (!/^https?:\/\//i.test(barkUrl)) return false

  try {
    const response = await fetch(`${barkUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: options.title,
        body: options.body,
        sound: 'alarm',
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Bark push failed:', error)
    return false
  }
}
