import { fetchWithTimeout } from '../http/fetch'
import { isSafeBarkTarget } from '../security/safe-url'
import { getUserNotificationSecrets } from './secrets'

export const BARK_ICON_URL = 'https://cdn.jsdelivr.net/gh/27Aaron/mimotion/app/icon.svg'

interface BarkPushOptions {
  userId: string
  title: string
  body: string
  subtitle?: string
}

async function getBarkUrl(userId: string): Promise<string | null> {
  return (await getUserNotificationSecrets(userId)).barkUrl
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
        icon: BARK_ICON_URL,
        ...(options.subtitle && { subtitle: options.subtitle }),
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Bark push failed:', error)
    return false
  }
}
