import test from 'node:test'
import assert from 'node:assert/strict'

const CURRENT_KEY = '11'.repeat(32)
const OTHER_KEY = '22'.repeat(32)

test('encrypted values carry a key id and only decrypt with the configured key', async () => {
  const originalCurrent = process.env.ENCRYPTION_KEY
  try {
    process.env.ENCRYPTION_KEY = CURRENT_KEY
    const { encrypt, decrypt, isEncryptedValue } = await import('../../lib/security/encryption')
    const encrypted = encrypt('secret-value')
    const legacyCiphertext = encrypted.encrypted.split(':')[2]

    assert.equal(isEncryptedValue(encrypt('new-value').encrypted), true)
    assert.equal(decrypt(encrypted.encrypted, encrypted.iv), 'secret-value')
    assert.equal(decrypt(legacyCiphertext, encrypted.iv), 'secret-value')

    process.env.ENCRYPTION_KEY = OTHER_KEY
    assert.throws(() => decrypt(encrypted.encrypted, encrypted.iv), /is not configured/)
  } finally {
    if (originalCurrent === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = originalCurrent
  }
})
