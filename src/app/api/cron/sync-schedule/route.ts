import { lockExpiredOpenMatches, syncWorldCupSchedule } from "@/lib/schedule-sync"

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const authorization = request.headers.get("authorization")
  const legacySecret = request.headers.get("x-cron-secret")

  if (!expected || (authorization !== `Bearer ${expected}` && legacySecret !== expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sync = await syncWorldCupSchedule()
  const locked = await lockExpiredOpenMatches()

  return Response.json({ ...sync, locked })
}
