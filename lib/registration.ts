import Database from 'better-sqlite3'

export type RegistrationResult = 'success' | 'invalid_code' | 'code_used' | 'username_taken'

interface RegistrationInput {
  userId: string
  username: string
  passwordHash: string
  inviteCode: string
  now: Date
}

export function registerUserWithInvite(
  sqlite: Database.Database,
  input: RegistrationInput,
): RegistrationResult {
  const transaction = sqlite.transaction((): RegistrationResult => {
    const code = sqlite
      .prepare('SELECT used_by FROM invite_codes WHERE code = ? LIMIT 1')
      .get(input.inviteCode) as { used_by: string | null } | undefined

    if (!code) return 'invalid_code'
    if (code.used_by) return 'code_used'

    const existingUser = sqlite
      .prepare('SELECT 1 FROM users WHERE username = ? LIMIT 1')
      .get(input.username)
    if (existingUser) return 'username_taken'

    const timestamp = input.now.getTime()
    sqlite.prepare(`
      INSERT INTO users (
        id, username, password_hash, is_admin, locale, created_at, updated_at
      ) VALUES (?, ?, ?, 0, 'zh', ?, ?)
    `).run(input.userId, input.username, input.passwordHash, timestamp, timestamp)

    const claimed = sqlite
      .prepare('UPDATE invite_codes SET used_by = ? WHERE code = ? AND used_by IS NULL')
      .run(input.userId, input.inviteCode)

    if (claimed.changes !== 1) {
      throw new Error('INVITE_CLAIM_FAILED')
    }

    return 'success'
  })

  // Acquire the write lock before checking the invite code to make the claim
  // atomic across multiple application processes.
  return transaction.immediate()
}
