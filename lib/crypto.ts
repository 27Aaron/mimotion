import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY is not set')
  // 支持 32 字节直接传入或 hex 编码的 32 字节
  if (key.length === 64) {
    return Buffer.from(key, 'hex')
  }
  if (key.length === 32) {
    return Buffer.from(key)
  }
  // 兼容旧版：使用 scrypt 派生
  return scryptSync(key, 'mimotion-salt', 32)
}

export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const iv = randomBytes(16)
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
