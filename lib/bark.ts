import { db } from './db'
import { users } from './db/schema'
import { eq } from 'drizzle-orm'
import { fetchWithTimeout } from './http'
import { isSafeBarkTarget } from './safe-url'

interface BarkPushOptions {
  userId: string
  title: string
  body: string
  subtitle?: string
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

  if (!(await isSafeBarkTarget(barkUrl))) return false

  try {
    const response = await fetchWithTimeout(barkUrl, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: options.title,
        body: options.body,
        sound: 'fanfare',
        group: 'MiMotion',
        ...(options.subtitle && { subtitle: options.subtitle }),
        ...(process.env.APP_URL && { icon: `${process.env.APP_URL}/icon.svg` }),
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Bark push failed:', error)
    return false
  }
}
