import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY is not set')
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hexadecimal characters')
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const iv = randomBytes(12)
  const key = getKey()
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return {
    encrypted: encrypted + authTag.toString('hex'),
    iv: iv.toString('hex'),
  }
}

export function decrypt(encrypted: string, iv: string): string {
  const key = getKey()
  const bufferIv = Buffer.from(iv, 'hex')
  const authTag = Buffer.from(encrypted.slice(-32), 'hex')
  const encryptedText = encrypted.slice(0, -32)
  const decipher = createDecipheriv(ALGORITHM, key, bufferIv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
