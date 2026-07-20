import crypto from 'node:crypto'
import { asc, eq } from 'drizzle-orm'

import { db, sqlite } from '../db'
import { schedules } from '../db/schema'
import { matchesCronExpression, minuteStart } from './cron'
import {
  claimNextExecution,
  enqueueExecution,
  recoverStaleExecutions,
  type ClaimedExecution,
} from './execution-store'
import { runClaimedExecution } from './schedule-runner'

const DEFAULT_POLL_INTERVAL_MS = 10_000
const DEFAULT_CONCURRENCY = 3

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function log(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), component: 'scheduler-worker', event, ...details }))
}

async function enqueueCurrentMinute(now: Date): Promise<number> {
  const slot = minuteStart(now)
  const activeSchedules = await db.select().from(schedules)
    .where(eq(schedules.isActive, true))
    .orderBy(asc(schedules.createdAt), asc(schedules.id))

  let enqueued = 0
  for (const schedule of activeSchedules) {
    if (!matchesCronExpression(schedule.cronExpression, slot)) continue
    if (enqueueExecution(sqlite, {
      id: crypto.randomUUID(),
      scheduleId: schedule.id,
      xiaomiAccountId: schedule.xiaomiAccountId,
      scheduledFor: slot,
      now,
    })) {
      enqueued++
    }
  }
  return enqueued
}

async function processPendingExecutions(now: Date, concurrency: number): Promise<number> {
  const claimed: ClaimedExecution[] = []
  for (let index = 0; index < concurrency; index++) {
    const execution = claimNextExecution(sqlite, now)
    if (!execution) break
    claimed.push(execution)
  }

  await Promise.all(claimed.map(async (execution) => {
    const result = await runClaimedExecution(execution)
    log('execution_finished', { ...result })
  }))
  return claimed.length
}

export function startWorker(): () => void {
  const pollIntervalMs = positiveInteger(process.env.WORKER_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS)
  const concurrency = positiveInteger(process.env.WORKER_CONCURRENCY, DEFAULT_CONCURRENCY)
  let running = false
  let stopped = false

  const tick = async () => {
    if (running || stopped) return
    running = true
    const now = new Date()
    try {
      const recovered = recoverStaleExecutions(sqlite, now)
      const enqueued = await enqueueCurrentMinute(now)
      const processed = await processPendingExecutions(now, concurrency)
      if (recovered.requeued || recovered.failed || enqueued || processed) {
        log('tick', { ...recovered, enqueued, processed })
      }
    } catch (error) {
      log('tick_failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      running = false
    }
  }

  log('started', { pollIntervalMs, concurrency })
  void tick()
  const interval = setInterval(() => void tick(), pollIntervalMs)

  return () => {
    stopped = true
    clearInterval(interval)
    log('stopped')
  }
}
