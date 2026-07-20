import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSetStepsRequest, setSteps } from '../../lib/xiaomi/client'

test('buildSetStepsRequest uses Shanghai date and a recent sync timestamp', () => {
  const now = new Date('2026-04-19T16:30:00.000Z') // 2026-04-20 00:30 in Shanghai
  const request = buildSetStepsRequest('device-1', 'user-1', 23456, now, 'request-1')

  assert.match(request.url, /t=1776616200000/)
  assert.match(request.url, /r=request-1/)
  assert.match(request.body, /userid=user-1/)
  assert.match(request.body, /last_deviceid=device-1/)
  assert.match(request.body, /last_sync_data_time=1776616080/)
  assert.match(request.body, /date%22%3A%222026-04-20%22/)
  assert.match(request.body, /ttl%5C%22%3A23456/)
})

test('setSteps classifies HTTP authentication failures', async () => {
  const result = await setSteps('expired-token', 'device-1', 'user-1', 12345, {
    now: () => new Date('2026-04-19T00:00:00.000Z'),
    requestId: () => 'request-1',
    fetch: async () => new Response('unauthorized', { status: 401 }),
  })

  assert.equal(result.success, false)
  assert.equal(result.errorCode, 'TOKEN_EXPIRED')
  assert.equal(result.retryable, false)
})

test('setSteps classifies vendor token failures returned with HTTP 200', async () => {
  const result = await setSteps('expired-token', 'device-1', 'user-1', 12345, {
    fetch: async () => Response.json({ message: 'invalid app_token' }),
  })

  assert.equal(result.success, false)
  assert.equal(result.errorCode, 'TOKEN_EXPIRED')
})

test('setSteps reports successful Zepp responses', async () => {
  const result = await setSteps('token', 'device-1', 'user-1', 12345, {
    fetch: async () => Response.json({ message: 'success' }),
  })

  assert.deepEqual(result, { success: true })
})
