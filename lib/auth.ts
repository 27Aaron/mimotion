import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { users } from './db/schema'

const JWT_ISSUER = 'mimotion'
const JWT_AUDIENCE = 'mimotion-web'

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error('JWT_SECRET must be at least 32 bytes')
  }
  return new TextEncoder().encode(secret)
}

export interface JWTPayload {
  userId: string
  username: string
  isAdmin: boolean
  [key: string]: unknown
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.username !== 'string' ||
      typeof payload.isAdmin !== 'boolean'
    ) {
      return null
    }
    return payload as JWTPayload
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null

  // Resolve mutable authorization data from the database so deleted users,
  // renamed users, and revoked admin privileges take effect immediately.
  const user = await db
    .select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1)

  if (!user[0]) return null
  return {
    userId: user[0].id,
    username: user[0].username,
    isAdmin: user[0].isAdmin ?? false,
  }
}
