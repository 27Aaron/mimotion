export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startScheduler } = await import('./lib/scheduler')
      startScheduler()
    } catch (error) {
      console.error('[Instrumentation] Failed to start scheduler:', error)
    }
  }
}
