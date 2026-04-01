import crypto from 'crypto'

// 与 Python 源码 aes_help.py 完全一致的密钥
const HM_AES_KEY = Buffer.from('xeNtBVqzDc6tuNTh') // 16 bytes
const HM_AES_IV = Buffer.from('MAAAYAAAAAAAAABg') // 16 bytes

interface LoginResult {
  success: boolean
  token?: string // app_token (用于提交步数)
  appToken?: string
  loginToken?: string
  userId?: string // 小米平台 user_id
  deviceId?: string
  error?: string
}

function pkcs7Pad(data: Buffer): Buffer {
  const blockSize = 16
  const padLen = blockSize - (data.length % blockSize)
  return Buffer.concat([data, Buffer.alloc(padLen, padLen)])
}

function encryptAes128Cbc(plain: Buffer, key: Buffer, iv: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
  cipher.setAutoPadding(false) // 我们手动 PKCS7 pad，禁用 Node.js 自动 pad（否则双重 padding）
  return Buffer.concat([cipher.update(plain), cipher.final()])
}

function generateDeviceId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/**
 * 判断是否为手机号，自动加 +86 前缀
 * 与 Python main.py MiMotionRunner.__init__ 逻辑完全一致
 */
function normalizeUser(user: string): { user: string; isPhone: boolean } {
  if (user.startsWith('+86') || user.includes('@')) {
    // 已经是国际格式或是邮箱
  } else {
    user = '+86' + user
  }
  const isPhone = user.startsWith('+86')
  return { user, isPhone }
}

/**
 * Step 1: 获取 access_token
 * 与 Python zepp_helper.login_access_token 完全一致
 */
async function loginAccessToken(user: string, password: string): Promise<{ token: string | null; error: string | null }> {
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'user-agent': 'MiFit6.14.0 (M2007J1SC; Android 12; Density/2.75)',
    'app_name': 'com.xiaomi.hm.health',
    'appname': 'com.xiaomi.hm.health',
    'appplatform': 'android_phone',
    'x-hm-ekv': '1',
    'hm-privacy-ceip': 'false',
  }

  const loginData = new URLSearchParams({
    emailOrPhone: user,
    password: password,
    state: 'REDIRECTION',
    client_id: 'HuaMi',
    country_code: 'CN',
    token: 'access',
    redirect_uri: 'https://s3-us-west-2.amazonaws.com/hm-registration/successsignin.html',
  })

  // Python: plaintext = query.encode('utf-8')，然后 encrypt_data(plaintext, key, iv) 返回 raw bytes
  const plaintext = Buffer.from(loginData.toString(), 'utf-8')
  const cipherData = encryptAes128Cbc(pkcs7Pad(plaintext), HM_AES_KEY, HM_AES_IV)

  const url1 = 'https://api-user.zepp.com/v2/registrations/tokens'

  console.log('[Xiaomi Auth] Step 1: POST', url1)
  console.log('[Xiaomi Auth] Step 1: cipher body length:', cipherData.length)

  try {
    const r1 = await fetch(url1, {
      method: 'POST',
      headers,
      body: new Uint8Array(cipherData),
      redirect: 'manual',
    })

    console.log('[Xiaomi Auth] Step 1 status:', r1.status)
    console.log('[Xiaomi Auth] Step 1 resp Content-Type:', r1.headers.get('content-type'))

    if (r1.status !== 303) {
      const errorBody = await r1.text().catch(() => 'unreadable')
      console.log('[Xiaomi Auth] Step 1 non-303 body:', errorBody.slice(0, 300))
      return { token: null, error: `登录异常，status: ${r1.status} ${errorBody.slice(0, 200)}` }
    }

    const location = r1.headers.get('Location')
    console.log('[Xiaomi Auth] Step 1 Location:', location)
    if (!location) {
      return { token: null, error: '获取accessToken失败：无重定向' }
    }

    // Python: code_pattern = re.compile("(?<=access=).*?(?=&)")
    const accessMatch = location.match(/(?<=access=).*?(?=&)/)
    const errorMatch = location.match(/(?<=error=).*?(?=&)/)

    if (errorMatch) {
      return { token: null, error: `登录失败: ${decodeURIComponent(errorMatch[0])}` }
    }
    if (!accessMatch) {
      return { token: null, error: '获取accessToken失败: ' + location.slice(0, 200) }
    }

    console.log('[Xiaomi Auth] Step 1 access_token:', accessMatch[0].slice(0, 20) + '...')
    return { token: accessMatch[0], error: null }
  } catch (error) {
    return { token: null, error: error instanceof Error ? error.message : '网络错误' }
  }
}

/**
 * Step 2: 获取 login_token, app_token, user_id
 * 与 Python zepp_helper.grant_login_tokens 完全一致
 */
async function grantLoginTokens(
  accessToken: string,
  deviceId: string,
  isPhone: boolean
): Promise<{ loginToken: string | null; appToken: string | null; userId: string | null; error: string | null }> {
  const url = 'https://account.huami.com/v2/client/login'
  const headers: Record<string, string> = {
    'app_name': 'com.xiaomi.hm.health',
    'x-request-id': crypto.randomUUID(),
    'accept-language': 'zh-CN',
    'appname': 'com.xiaomi.hm.health',
    'cv': '50818_6.14.0',
    'v': '2.0',
    'appplatform': 'android_phone',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  }

  // 与 Python 源码完全一致：手机号和邮箱使用不同的参数
  let data: Record<string, string>
  if (isPhone) {
    data = {
      'app_name': 'com.xiaomi.hm.health',
      'app_version': '6.14.0',
      'code': accessToken,
      'country_code': 'CN',
      'device_id': deviceId,
      'device_model': 'phone',
      'grant_type': 'access_token',
      'third_name': 'huami_phone',
    }
  } else {
    data = {
      'allow_registration=': 'false', // Python 源码 key 带 = 号，URL编码后为 allow_registration%3D=false
      'app_name': 'com.xiaomi.hm.health',
      'app_version': '6.14.0',
      'code': accessToken,
      'country_code': 'CN',
      'device_id': deviceId,
      'device_model': 'android_phone',
      'dn': 'account.zepp.com,api-user.zepp.com,api-mifit.zepp.com,api-watch.zepp.com,app-analytics.zepp.com,api-analytics.huami.com,auth.zepp.com',
      'grant_type': 'access_token',
      'lang': 'zh_CN',
      'os_version': '1.5.0',
      'source': 'com.xiaomi.hm.health:6.14.0:50818',
      'third_name': 'email',
    }
  }

  console.log('[Xiaomi Auth] Step 2: POST', url, 'isPhone:', isPhone)

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: new URLSearchParams(data).toString(),
    })

    console.log('[Xiaomi Auth] Step 2 status:', resp.status)
    const respData = await resp.json()
    console.log('[Xiaomi Auth] Step 2 response:', JSON.stringify(respData).slice(0, 500))

    const result = respData.result
    if (result !== 'ok') {
      return { loginToken: null, appToken: null, userId: null, error: `客户端登录失败: ${result}` }
    }

    const tokenInfo = respData.token_info
    if (!tokenInfo) {
      return { loginToken: null, appToken: null, userId: null, error: '无 token_info' }
    }

    const loginToken = tokenInfo.login_token || null
    const appToken = tokenInfo.app_token || null
    const userId = tokenInfo.user_id || null

    console.log('[Xiaomi Auth] Step 2 success. userId:', userId, 'appToken:', appToken ? appToken.slice(0, 20) + '...' : 'null')

    return { loginToken, appToken, userId, error: null }
  } catch (error) {
    return { loginToken: null, appToken: null, userId: null, error: error instanceof Error ? error.message : '网络错误' }
  }
}

/**
 * 完整登录流程：与 Python MiMotionRunner.login() 对齐
 */
export async function loginXiaomiAccount(
  account: string,
  password: string
): Promise<LoginResult> {
  // 自动加 +86 前缀，与 Python 一致
  const { user, isPhone } = normalizeUser(account)
  const deviceId = generateDeviceId()

  console.log('[Xiaomi Auth] Login for:', user, 'isPhone:', isPhone, 'deviceId:', deviceId)

  // Step 1: 获取 access_token
  const { token: accessToken, error: step1Error } = await loginAccessToken(user, password)
  if (!accessToken) {
    return { success: false, error: step1Error || '登录获取accessToken失败' }
  }

  // Step 2: 获取 login_token, app_token, user_id
  const { loginToken, appToken, userId, error: step2Error } = await grantLoginTokens(accessToken, deviceId, isPhone)
  if (!appToken) {
    return { success: false, error: step2Error || '获取app_token失败' }
  }

  return {
    success: true,
    token: appToken, // 用 app_token 提交步数，与 Python post_fake_brand_data 一致
    appToken,
    loginToken: loginToken || undefined,
    userId: userId || undefined,
    deviceId,
  }
}
