import { eq } from 'drizzle-orm'

import { decrypt, encrypt } from './crypto'
import { db } from './db'
import { users } from './db/schema'

export interface UserNotificationSecrets {
  barkUrl: string | null
  telegramBotToken: string | null
  telegramChatId: string | null
}

function decryptSecret(data: string | null, iv: string | null, legacy: string | null): string | null {
  if (data && iv) return decrypt(data, iv)
  return legacy || null
}

export async function getUserNotificationSecrets(
  userId: string,
  migrateLegacy = true,
): Promise<UserNotificationSecrets> {
  const rows = await db.select({
    barkUrl: users.barkUrl,
    barkUrlData: users.barkUrlData,
    barkUrlIv: users.barkUrlIv,
    telegramBotToken: users.telegramBotToken,
    telegramBotTokenData: users.telegramBotTokenData,
    telegramBotTokenIv: users.telegramBotTokenIv,
    telegramChatId: users.telegramChatId,
  }).from(users).where(eq(users.id, userId)).limit(1)

  const row = rows[0]
  if (!row) return { barkUrl: null, telegramBotToken: null, telegramChatId: null }

  const secrets = {
    barkUrl: decryptSecret(row.barkUrlData, row.barkUrlIv, row.barkUrl),
    telegramBotToken: decryptSecret(
      row.telegramBotTokenData,
      row.telegramBotTokenIv,
      row.telegramBotToken,
    ),
    telegramChatId: row.telegramChatId || null,
  }

  const hasLegacy = Boolean(
    (row.barkUrl && !row.barkUrlData) ||
    (row.telegramBotToken && !row.telegramBotTokenData),
  )
  if (migrateLegacy && hasLegacy) {
    await db.update(users).set({
      ...buildNotificationSecretUpdate({
        barkUrl: secrets.barkUrl,
        telegramBotToken: secrets.telegramBotToken,
      }),
      updatedAt: new Date(),
    }).where(eq(users.id, userId))
  }

  return secrets
}

export function buildNotificationSecretUpdate(input: {
  barkUrl?: string | null
  telegramBotToken?: string | null
}): Partial<typeof users.$inferInsert> {
  const update: Partial<typeof users.$inferInsert> = {}

  if (input.barkUrl !== undefined) {
    if (input.barkUrl) {
      const encrypted = encrypt(input.barkUrl)
      update.barkUrlData = encrypted.encrypted
      update.barkUrlIv = encrypted.iv
    } else {
      update.barkUrlData = null
      update.barkUrlIv = null
    }
    update.barkUrl = null
  }

  if (input.telegramBotToken !== undefined) {
    if (input.telegramBotToken) {
      const encrypted = encrypt(input.telegramBotToken)
      update.telegramBotTokenData = encrypted.encrypted
      update.telegramBotTokenIv = encrypted.iv
    } else {
      update.telegramBotTokenData = null
      update.telegramBotTokenIv = null
    }
    update.telegramBotToken = null
  }

  return update
}
