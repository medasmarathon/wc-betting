import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase/admin"

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET
  const actual = request.headers.get("x-cron-secret")
  if (!expected || actual !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = getAdminDb()
  const snap = await db
    .collection("matches")
    .where("status", "in", ["SCHEDULED", "OPEN"])
    .where("kickoffAt", "<=", new Date())
    .get()

  const batch = db.batch()
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: "LOCKED",
      lockedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
  await batch.commit()
  return Response.json({ locked: snap.size })
}
