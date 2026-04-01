import { NextResponse } from 'next/server'
import { startScheduler } from '@/lib/scheduler'

let schedulerStarted = false

export async function POST() {
  if (!schedulerStarted) {
    startScheduler()
    schedulerStarted = true
  }

  return NextResponse.json({ success: true })
}
