import Database from 'better-sqlite3'

export function isOwnedXiaomiAccount(
  sqlite: Database.Database,
  userId: string,
  xiaomiAccountId: string,
): boolean {
  const row = sqlite
    .prepare('SELECT 1 FROM xiaomi_accounts WHERE id = ? AND user_id = ? LIMIT 1')
    .get(xiaomiAccountId, userId)

  return Boolean(row)
}

export function deleteOwnedSchedule(
  sqlite: Database.Database,
  scheduleId: string,
  userId: string,
): boolean {
  const transaction = sqlite.transaction(() => {
    const ownedSchedule = sqlite
      .prepare('SELECT id FROM schedules WHERE id = ? AND user_id = ? LIMIT 1')
      .get(scheduleId, userId)

    if (!ownedSchedule) return false

    sqlite.prepare('DELETE FROM run_logs WHERE schedule_id = ?').run(scheduleId)
    const deleted = sqlite
      .prepare('DELETE FROM schedules WHERE id = ? AND user_id = ?')
      .run(scheduleId, userId)

    return deleted.changes === 1
  })

  return transaction()
}

export function deleteOwnedUnusedInviteCode(
  sqlite: Database.Database,
  code: string,
  ownerId: string,
): 'deleted' | 'used' | 'not_found' {
  const inviteCode = sqlite
    .prepare('SELECT code, used_by FROM invite_codes WHERE code = ? AND created_by = ? LIMIT 1')
    .get(code, ownerId) as { code: string; used_by: string | null } | undefined

  if (!inviteCode) return 'not_found'
  if (inviteCode.used_by) return 'used'

  sqlite.prepare('DELETE FROM invite_codes WHERE code = ? AND created_by = ?').run(code, ownerId)
  return 'deleted'
}
