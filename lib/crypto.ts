import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const FORMAT_VERSION = 'v1'

interface EncryptionKey {
  id: string
  value: Buffer
}

function parseKey(value: string, variableName: string): EncryptionKey {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${variableName} must contain 64 hexadecimal characters per key`)
  }
  const normalized = value.toLowerCase()
  return {
    id: createHash('sha256').update(normalized).digest('hex').slice(0, 12),
    value: Buffer.from(normalized, 'hex'),
  }
}

function getKeys(): EncryptionKey[] {
  const current = process.env.ENCRYPTION_KEY
  if (!current) throw new Error('ENCRYPTION_KEY is not set')

  const previous = (process.env.ENCRYPTION_KEY_PREVIOUS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const keys = [parseKey(current, 'ENCRYPTION_KEY')]
  previous.forEach((value) => keys.push(parseKey(value, 'ENCRYPTION_KEY_PREVIOUS')))
  return keys.filter((key, index, all) => all.findIndex((candidate) => candidate.id === key.id) === index)
}

function decryptWithKey(payload: string, iv: string, key: Buffer): string {
  const bufferIv = Buffer.from(iv, 'hex')
  const authTag = Buffer.from(payload.slice(-32), 'hex')
  const encryptedText = payload.slice(0, -32)
  const decipher = createDecipheriv(ALGORITHM, key, bufferIv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const iv = randomBytes(12)
  const key = getKeys()[0]
  const cipher = createCipheriv(ALGORITHM, key.value, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const payload = encrypted + cipher.getAuthTag().toString('hex')
  return {
    encrypted: `${FORMAT_VERSION}:${key.id}:${payload}`,
    iv: iv.toString('hex'),
  }
}

export function decrypt(encrypted: string, iv: string): string {
  const keys = getKeys()
  const versioned = encrypted.match(/^v1:([0-9a-f]{12}):([0-9a-f]+)$/i)

  if (versioned) {
    const key = keys.find((candidate) => candidate.id === versioned[1].toLowerCase())
    if (!key) throw new Error(`Encryption key ${versioned[1]} is not configured`)
    return decryptWithKey(versioned[2], iv, key.value)
  }

  // Legacy ciphertexts did not include a version or key id. Try the current
  // key first and then the configured previous keys for seamless rotation.
  for (const key of keys) {
    try {
      return decryptWithKey(encrypted, iv, key.value)
    } catch {
      // Try the next key.
    }
  }
  throw new Error('Unable to decrypt data with the configured encryption keys')
}

export function isEncryptedValue(value: string | null | undefined): boolean {
  return Boolean(value && /^v1:[0-9a-f]{12}:[0-9a-f]+$/i.test(value))
}
