import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

function initializeAdminApp() {
  if (getApps().length) return

  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is required")
  }

  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    initializeApp({ projectId })
    return
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are required outside emulator mode")
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

export function getAdminAuth() {
  initializeAdminApp()
  return getAuth()
}

export function getAdminDb() {
  initializeAdminApp()
  return getFirestore()
}
