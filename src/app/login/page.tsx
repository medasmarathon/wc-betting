"use client"

import { Button } from "@mantine/core"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"

export default function LoginPage() {
  const { firebaseUser, profile, error, loginWithGoogle } = useAuth()
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (firebaseUser && profile) router.replace("/matches")
  }, [firebaseUser, profile, router])

  async function signInWithGoogle() {
    setPending(true)
    setMessage(null)
    try {
      await loginWithGoogle()
      router.replace("/matches")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Sign in failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page grid min-h-[calc(100vh-64px)] place-items-center">
      <section className="panel grid w-full max-w-md gap-5 p-6">
        <div>
          <h1 className="page-title text-2xl font-black">Sign in</h1>
          <p className="page-subtitle mt-1 text-sm">Invite-only, points-only World Cup pool.</p>
        </div>
        <Button variant="outline" onClick={signInWithGoogle} disabled={pending} loading={pending}>
          Continue with Google
        </Button>
        {message || error ? <p className="danger-text text-sm">{message ?? error}</p> : null}
      </section>
    </main>
  )
}
