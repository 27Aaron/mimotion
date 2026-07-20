import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const isDevelopment = process.argv.includes('--dev')
const role = process.env.MIMOTION_ROLE || 'all'
const validRoles = new Set(['all', 'web', 'worker'])

if (!validRoles.has(role)) {
  console.error(`Invalid MIMOTION_ROLE: ${role}. Expected all, web, or worker.`)
  process.exit(1)
}

const migration = spawnSync(process.execPath, ['scripts/init-db.mjs'], {
  stdio: 'inherit',
  env: process.env,
})
if (migration.status !== 0) process.exit(migration.status || 1)

const children = []
let shuttingDown = false

function executable(name) {
  const suffix = process.platform === 'win32' ? '.cmd' : ''
  return path.join(process.cwd(), 'node_modules', '.bin', `${name}${suffix}`)
}

function launch(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  })
  children.push(child)
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    console.error(`[Process] ${name} exited`, { code, signal })
    shutdown(signal || 'SIGTERM', code ?? 1)
  })
}

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
  setTimeout(() => process.exit(exitCode), 250).unref()
}

if (role === 'all' || role === 'web') {
  if (isDevelopment) {
    launch('web', executable('next'), ['dev'])
  } else if (fs.existsSync(path.join(process.cwd(), 'server.js'))) {
    launch('web', process.execPath, ['server.js'])
  } else {
    launch('web', executable('next'), ['start'])
  }
}

if (role === 'all' || role === 'worker') {
  if (isDevelopment) {
    launch('worker', executable('tsx'), ['worker/main.ts'])
  } else {
    launch('worker', process.execPath, ['.worker/worker.mjs'])
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
