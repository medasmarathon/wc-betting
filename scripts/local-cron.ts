import { setTimeout as sleep } from "node:timers/promises"
import { config } from "dotenv"

config({ path: ".env.local", override: false, quiet: true })

type CronJob = {
  method: "GET" | "POST"
  path: string
}

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000
const DEFAULT_STARTUP_WAIT_MS = 2 * 60 * 1000
const DEFAULT_STARTUP_RETRY_MS = 1000
const DEFAULT_JOB = "GET:/api/cron/sync-schedule"

async function main() {
  if (!booleanEnv("LOCAL_CRON_ENABLED", true)) {
    console.log("Local cron disabled. Set LOCAL_CRON_ENABLED=true to run it.")
    return
  }

  if (!process.env.FIRESTORE_EMULATOR_HOST && process.env.LOCAL_CRON_ALLOW_NON_EMULATOR !== "true") {
    throw new Error("Refusing to run local cron without FIRESTORE_EMULATOR_HOST.")
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) throw new Error("CRON_SECRET is required to run local cron.")

  const baseUrl = trimTrailingSlash(process.env.LOCAL_CRON_BASE_URL ?? "http://localhost:3000")
  const intervalMs = positiveIntegerEnv("LOCAL_CRON_INTERVAL_MS", DEFAULT_INTERVAL_MS)
  const startupWaitMs = nonNegativeIntegerEnv("LOCAL_CRON_STARTUP_WAIT_MS", DEFAULT_STARTUP_WAIT_MS)
  const startupRetryMs = positiveIntegerEnv("LOCAL_CRON_STARTUP_RETRY_MS", DEFAULT_STARTUP_RETRY_MS)
  const runOnStart = booleanEnv("LOCAL_CRON_RUN_ON_START", true)
  const jobs = parseJobs(process.env.LOCAL_CRON_JOBS ?? DEFAULT_JOB)

  console.log(
    `Local cron started: ${jobs.map((job) => `${job.method} ${job.path}`).join(", ")} every ${intervalMs}ms at ${baseUrl}`,
  )

  if (runOnStart) {
    await waitForServer(baseUrl, startupWaitMs, startupRetryMs)
    await runJobs(baseUrl, cronSecret, jobs)
  }

  for (;;) {
    await sleep(intervalMs)
    await runJobs(baseUrl, cronSecret, jobs)
  }
}

async function runJobs(baseUrl: string, cronSecret: string, jobs: CronJob[]) {
  await Promise.all(jobs.map((job) => runJob(baseUrl, cronSecret, job)))
}

async function waitForServer(baseUrl: string, timeoutMs: number, retryMs: number) {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown

  while (Date.now() <= deadline) {
    try {
      await fetch(baseUrl, { method: "HEAD" })
      return
    } catch (error) {
      lastError = error
      if (timeoutMs === 0) break
      await sleep(Math.min(retryMs, Math.max(deadline - Date.now(), 0)))
    }
  }

  console.warn(`Local cron could not confirm ${baseUrl} is ready before startup run.`, lastError)
}

async function runJob(baseUrl: string, cronSecret: string, job: CronJob) {
  const startedAt = new Date()
  const url = new URL(job.path, baseUrl).toString()

  try {
    const response = await fetch(url, {
      method: job.method,
      headers: { "x-cron-secret": cronSecret },
    })
    const body = await response.text()

    if (!response.ok) {
      console.error(`[${startedAt.toISOString()}] ${job.method} ${job.path} failed: ${response.status} ${body}`)
      return
    }

    console.log(`[${startedAt.toISOString()}] ${job.method} ${job.path} ok: ${truncate(body)}`)
  } catch (error) {
    console.error(`[${startedAt.toISOString()}] ${job.method} ${job.path} failed:`, error)
  }
}

function parseJobs(value: string): CronJob[] {
  const jobs = value
    .split(",")
    .map((job) => job.trim())
    .filter(Boolean)
    .map(parseJob)

  if (!jobs.length) throw new Error("LOCAL_CRON_JOBS must include at least one job.")
  return jobs
}

function parseJob(value: string): CronJob {
  const [maybeMethod, ...rest] = value.split(":")
  const hasMethod = rest.length > 0 && /^[A-Za-z]+$/.test(maybeMethod)
  const method = (hasMethod ? maybeMethod.toUpperCase() : "GET") as CronJob["method"]
  const path = hasMethod ? rest.join(":") : value

  if (method !== "GET" && method !== "POST") {
    throw new Error(`Unsupported local cron method: ${method}`)
  }
  if (!path.startsWith("/")) {
    throw new Error(`Local cron path must start with "/": ${path}`)
  }

  return { method, path }
}

function booleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]
  if (value === undefined || value === "") return fallback
  return value.toLowerCase() === "true"
}

function positiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name]
  if (value === undefined || value === "") return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return parsed
}

function nonNegativeIntegerEnv(name: string, fallback: number) {
  const value = process.env[name]
  if (value === undefined || value === "") return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`)
  }
  return parsed
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function truncate(value: string) {
  return value.length > 500 ? `${value.slice(0, 500)}...` : value
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
