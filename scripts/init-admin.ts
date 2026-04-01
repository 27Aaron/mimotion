import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import { hashPassword } from '../lib/auth'
import { v4 as uuid } from 'uuid'
import { eq } from 'drizzle-orm'

async function initAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'password'

  const existing = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1)

  if (existing[0]) {
    console.log('Admin user already exists')
    return
  }

  const passwordHash = await hashPassword(adminPassword)
  const now = new Date()

  await db.insert(users).values({
    id: uuid(),
    email: adminEmail,
    passwordHash,
    isAdmin: true,
    createdAt: now,
    updatedAt: now,
  })

  console.log(`Admin user created: ${adminEmail}`)
}

initAdmin()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })