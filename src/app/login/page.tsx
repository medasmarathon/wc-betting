"use client"

import { Button } from "@mantine/core"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { LanguageSwitch, useI18n } from "@/components/language-provider"

export default function LoginPage() {
  const { t } = useI18n()
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
      setMessage(caught instanceof Error ? caught.message : t.auth.signInFailed)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page grid min-h-[calc(100vh-64px)] place-items-center">
      <section className="panel grid w-full max-w-md gap-5 p-6">
        <div className="justify-self-end">
          <LanguageSwitch />
        </div>
        <div>
          <h1 className="page-title text-2xl font-black">{t.auth.signInTitle}</h1>
          <p className="page-subtitle mt-1 text-sm">{t.auth.signInSubtitle}</p>
        </div>
        <Button variant="outline" onClick={signInWithGoogle} disabled={pending} loading={pending}>
          {t.auth.signInWithGoogle}
        </Button>
        {message || error ? <p className="danger-text text-sm">{message ?? error}</p> : null}
      </section>
    </main>
  )
}
