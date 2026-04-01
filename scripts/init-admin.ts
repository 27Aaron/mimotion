import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import { hashPassword } from '../lib/auth'
import { v4 as uuid } from 'uuid'
import { eq } from 'drizzle-orm'

async function initAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'password'

  const existing = await db.select().from(users).where(eq(users.username, adminUsername)).limit(1)

  if (existing[0]) {
    console.log('Admin user already exists')
    return
  }

  const passwordHash = await hashPassword(adminPassword)
  const now = new Date()

  await db.insert(users).values({
    id: uuid(),
    username: adminUsername,
    passwordHash,
    isAdmin: true,
    createdAt: now,
    updatedAt: now,
  })

  console.log(`Admin user created: ${adminUsername}`)
}

initAdmin()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
