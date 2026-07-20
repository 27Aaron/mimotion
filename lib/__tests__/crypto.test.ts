import test from 'node:test'
import assert from 'node:assert/strict'

const CURRENT_KEY = '11'.repeat(32)
const PREVIOUS_KEY = '22'.repeat(32)

test('encrypted values carry a key id and previous keys can decrypt legacy data', async () => {
  const originalCurrent = process.env.ENCRYPTION_KEY
  const originalPrevious = process.env.ENCRYPTION_KEY_PREVIOUS
  try {
    process.env.ENCRYPTION_KEY = PREVIOUS_KEY
    const { encrypt, decrypt, isEncryptedValue } = await import('../crypto')
    const encryptedWithPrevious = encrypt('secret-value')
    const legacyCiphertext = encryptedWithPrevious.encrypted.split(':')[2]

    process.env.ENCRYPTION_KEY = CURRENT_KEY
    process.env.ENCRYPTION_KEY_PREVIOUS = PREVIOUS_KEY

    assert.equal(isEncryptedValue(encrypt('new-value').encrypted), true)
    assert.equal(decrypt(encryptedWithPrevious.encrypted, encryptedWithPrevious.iv), 'secret-value')
    assert.equal(decrypt(legacyCiphertext, encryptedWithPrevious.iv), 'secret-value')
  } finally {
    if (originalCurrent === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = originalCurrent
    if (originalPrevious === undefined) delete process.env.ENCRYPTION_KEY_PREVIOUS
    else process.env.ENCRYPTION_KEY_PREVIOUS = originalPrevious
  }
})
