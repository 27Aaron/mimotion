import test from 'node:test'
import assert from 'node:assert/strict'

const CURRENT_KEY = '11'.repeat(32)

test('syncXiaomiAccount refreshes an expired app token and retries the same step', async () => {
  const originalCurrent = process.env.ENCRYPTION_KEY
  try {
    process.env.ENCRYPTION_KEY = CURRENT_KEY
    const { encrypt, decrypt } = await import('../crypto')
    const { syncXiaomiAccount } = await import('../xiaomi/sync-account')
    const app = encrypt('old-app-token')
    const login = encrypt('login-token')
    const writtenSteps: number[] = []
    let writeAttempt = 0

    const result = await syncXiaomiAccount({
      id: 'account-1',
      account: 'user@example.com',
      xiaomiUserId: 'xiaomi-user-1',
      deviceId: 'device-1',
      tokenData: app.encrypted,
      tokenIv: app.iv,
      loginTokenData: login.encrypted,
      loginTokenIv: login.iv,
      passwordData: null,
      passwordIv: null,
    }, 23456, {
      writeSteps: async (_token, _deviceId, _userId, steps) => {
        writtenSteps.push(steps)
        writeAttempt++
        return writeAttempt === 1
          ? { success: false, errorCode: 'TOKEN_EXPIRED', retryable: false }
          : { success: true }
      },
      refreshToken: async () => ({
        appToken: 'new-app-token',
        loginToken: 'new-login-token',
        error: null,
      }),
    })

    assert.equal(result.success, true)
    assert.deepEqual(writtenSteps, [23456, 23456])
    assert.equal(
      decrypt(result.credentialUpdate!.tokenData, result.credentialUpdate!.tokenIv),
      'new-app-token',
    )
  } finally {
    if (originalCurrent === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = originalCurrent
  }
})
