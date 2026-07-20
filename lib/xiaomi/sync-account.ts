import { decrypt, encrypt } from '../security/encryption'
import { loginXiaomiAccount, refreshAppToken } from './auth'
import { setSteps, type SetStepResult } from './client'

export interface StoredXiaomiCredentials {
  id: string
  account: string | null
  xiaomiUserId: string | null
  deviceId: string | null
  tokenData: string
  tokenIv: string | null
  loginTokenData: string | null
  loginTokenIv: string | null
  passwordData: string | null
  passwordIv: string | null
}

export interface CredentialUpdate {
  tokenData: string
  tokenIv: string
  loginTokenData?: string
  loginTokenIv?: string
  deviceId?: string
  xiaomiUserId?: string
}

export interface AccountSyncResult extends SetStepResult {
  credentialUpdate?: CredentialUpdate
  tokenExpired?: boolean
}

interface SyncDependencies {
  writeSteps: typeof setSteps
  refreshToken: typeof refreshAppToken
  login: typeof loginXiaomiAccount
}

function encryptedTokenUpdate(
  appToken: string,
  loginToken?: string | null,
): CredentialUpdate {
  const app = encrypt(appToken)
  const update: CredentialUpdate = {
    tokenData: app.encrypted,
    tokenIv: app.iv,
  }

  if (loginToken) {
    const login = encrypt(loginToken)
    update.loginTokenData = login.encrypted
    update.loginTokenIv = login.iv
  }

  return update
}

export async function syncXiaomiAccount(
  credentials: StoredXiaomiCredentials,
  steps: number,
  dependencies: Partial<SyncDependencies> = {},
): Promise<AccountSyncResult> {
  const writeSteps = dependencies.writeSteps || setSteps
  const refreshToken = dependencies.refreshToken || refreshAppToken
  const login = dependencies.login || loginXiaomiAccount

  const appToken = decrypt(credentials.tokenData, credentials.tokenIv || '')
  let result = await writeSteps(
    appToken,
    credentials.deviceId || '',
    credentials.xiaomiUserId || '',
    steps,
  )

  if (result.success || result.errorCode !== 'TOKEN_EXPIRED') return result

  if (credentials.loginTokenData && credentials.loginTokenIv) {
    const loginToken = decrypt(credentials.loginTokenData, credentials.loginTokenIv)
    const refreshed = await refreshToken(loginToken, credentials.deviceId || '')

    if (refreshed.appToken) {
      const credentialUpdate = encryptedTokenUpdate(refreshed.appToken, refreshed.loginToken)
      result = await writeSteps(
        refreshed.appToken,
        credentials.deviceId || '',
        credentials.xiaomiUserId || '',
        steps,
      )
      return { ...result, credentialUpdate, tokenExpired: result.errorCode === 'TOKEN_EXPIRED' }
    }
  }

  if (
    credentials.account &&
    credentials.passwordData &&
    credentials.passwordIv
  ) {
    const password = decrypt(credentials.passwordData, credentials.passwordIv)
    const relogin = await login(credentials.account, password)

    if (relogin.success && relogin.token) {
      const credentialUpdate = encryptedTokenUpdate(relogin.token, relogin.loginToken)
      if (relogin.deviceId) credentialUpdate.deviceId = relogin.deviceId
      if (relogin.userId) credentialUpdate.xiaomiUserId = relogin.userId

      result = await writeSteps(
        relogin.token,
        relogin.deviceId || credentials.deviceId || '',
        relogin.userId || credentials.xiaomiUserId || '',
        steps,
      )
      return { ...result, credentialUpdate, tokenExpired: result.errorCode === 'TOKEN_EXPIRED' }
    }

    return {
      success: false,
      error: relogin.error || '小米账号重新登录失败',
      errorCode: 'TOKEN_EXPIRED',
      retryable: false,
      tokenExpired: true,
    }
  }

  return {
    ...result,
    error: result.error || '登录凭证已过期，请重新绑定账号',
    errorCode: 'TOKEN_EXPIRED',
    retryable: false,
    tokenExpired: true,
  }
}
