"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"

export default function LoginPage() {
  const { firebaseUser, profile, error, loginWithEmail, loginWithGoogle } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("admin@example.com")
  const [password, setPassword] = useState("password123")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (firebaseUser && profile) router.replace("/matches")
  }, [firebaseUser, profile, router])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await loginWithEmail(email, password)
      router.replace("/matches")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Sign in failed")
    } finally {
      setPending(false)
    }
  }

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
          <h1 className="text-2xl font-black">Sign in</h1>
          <p className="mt-1 text-sm text-stone-600">Invite-only, points-only World Cup pool.</p>
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-bold">
            Email
            <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Password
            <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="button" disabled={pending}>
            Sign in
          </button>
        </form>
        <button className="button secondary" onClick={signInWithGoogle} disabled={pending}>
          Continue with Google
        </button>
        {message || error ? <p className="text-sm text-red-700">{message ?? error}</p> : null}
      </section>
    </main>
  )
}
