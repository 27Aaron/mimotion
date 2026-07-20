import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldUseSecureAuthCookie } from '../../lib/auth/auth-cookie'

test('auth cookie is secure by default in production', () => {
  assert.equal(shouldUseSecureAuthCookie({ NODE_ENV: 'production' }), true)
})

test('AUTH_COOKIE_SECURE=false allows HTTP deployments', () => {
  assert.equal(
    shouldUseSecureAuthCookie({ NODE_ENV: 'production', AUTH_COOKIE_SECURE: 'false' }),
    false,
  )
  assert.equal(
    shouldUseSecureAuthCookie({ NODE_ENV: 'production', AUTH_COOKIE_SECURE: ' FALSE ' }),
    false,
  )
})

test('AUTH_COOKIE_SECURE=true can require secure cookies outside production', () => {
  assert.equal(
    shouldUseSecureAuthCookie({ NODE_ENV: 'development', AUTH_COOKIE_SECURE: 'true' }),
    true,
  )
})

test('auth cookie is not secure by default outside production', () => {
  assert.equal(shouldUseSecureAuthCookie({ NODE_ENV: 'development' }), false)
})
