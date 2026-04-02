import Database from 'better-sqlite3'

export function claimScheduleExecution(
  sqlite: Database.Database,
  scheduleId: string,
  minuteStart: Date,
  claimTime: Date,
): boolean {
  const result = sqlite
    .prepare(`
      UPDATE schedules
      SET last_run_at = ?, updated_at = ?
      WHERE id = ?
        AND (last_run_at IS NULL OR last_run_at < ?)
    `)
    .run(
      claimTime.getTime(),
      claimTime.getTime(),
      scheduleId,
      minuteStart.getTime(),
    )

  return result.changes === 1
}
