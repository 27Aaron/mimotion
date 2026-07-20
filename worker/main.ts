import { startWorker } from '../lib/scheduling/worker'

const stop = startWorker()

function shutdown(signal: string) {
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    component: 'scheduler-worker',
    event: 'shutdown',
    signal,
  }))
  stop()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
