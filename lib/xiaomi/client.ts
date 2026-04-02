import crypto from 'crypto'
import { decrypt } from '../crypto'

interface SetStepResult {
  success: boolean
  error?: string
}

function getTime(): string {
  const now = new Date()
  return Math.floor(now.getTime()).toString()
}

export async function setSteps(
  token: string,
  deviceId: string,
  xiaomiUserId: string,
  steps: number
): Promise<SetStepResult> {
  const t = getTime()
  const today = new Date().toISOString().split('T')[0]

  // Build data_json with fake step data, URL-encode to match Python behavior
  const dataJson = encodeURIComponent(`{"date":"${today}","data":[{"ttl":${steps},"dis":0,"code":0}]}`)

  const url = `https://api-mifit-cn.huami.com/v1/data/band_data.json?&t=${t}&r=${crypto.randomUUID()}`
  const postData = `userid=${xiaomiUserId}&last_sync_data_time=1597306380&device_type=0&last_deviceid=${deviceId || 'DA932FFFFE8816E7'}&data_json=${dataJson}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apptoken: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData,
    })

    if (response.status !== 200) {
      const text = await response.text().catch(() => '')
      return { success: false, error: `请求异常: ${response.status} ${text.slice(0, 200)}` }
    }

    // 与 Python 一致：检查 response["message"] == "success"
    const respData = await response.json()
    const message = respData['message']
    if (message === 'success') {
      return { success: true }
    } else {
      return { success: false, error: `设置步数失败: ${message || JSON.stringify(respData).slice(0, 200)}` }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误',
    }
  }
}

export function decryptTokenData(encryptedData: string, iv: string): string {
  return decrypt(encryptedData, iv)
}

export function generateRandomStep(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
