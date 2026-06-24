"use client"

import { Alert, Center, Loader } from "@mantine/core"
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { auth } from "@/lib/firebase/client"
import { LanguageSwitch, useI18n } from "@/components/language-provider"

type Profile = {
  uid: string
  email: string
  displayName: string
  role: "USER" | "ADMIN"
  isActive: boolean
}

type AuthContextValue = {
  firebaseUser: User | null
  profile: Profile | null
  loading: boolean
  error: string | null
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<Profile>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n()
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiFetch = useMemo(
    () => async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const token = await auth.currentUser?.getIdToken()
      const headers = new Headers(init.headers)
      if (token) headers.set("authorization", `Bearer ${token}`)
      headers.set("x-locale", locale)
      if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json")
      return fetch(input, { ...init, headers })
    },
    [locale],
  )

  async function loadProfileForUser(nextUser: User) {
    const token = await nextUser.getIdToken()
    const response = await fetch("/api/me", {
      headers: { authorization: `Bearer ${token}` },
    })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error ?? "Unable to load profile")
    setProfile(json.user)
    setError(null)
    return json.user as Profile
  }

  async function refreshProfile() {
    if (!auth.currentUser) throw new Error("No signed-in user")
    return loadProfileForUser(auth.currentUser)
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setFirebaseUser(nextUser)
      setProfile(null)
      setError(null)
      if (!nextUser) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        await loadProfileForUser(nextUser)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load profile")
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value: AuthContextValue = {
    firebaseUser,
    profile,
    loading,
    error,
    apiFetch,
    loginWithGoogle: async () => {
      setLoading(true)
      try {
        const credential = await signInWithPopup(auth, new GoogleAuthProvider())
        setFirebaseUser(credential.user)
        await loadProfileForUser(credential.user)
      } finally {
        setLoading(false)
      }
    },
    logout: async () => {
      await signOut(auth)
    },
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}

export function AuthGate({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { t } = useI18n()
  const { firebaseUser, profile, loading, error } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login")
  }, [firebaseUser, loading, router])

  if (loading) {
    return (
      <main className="page">
        <Center py="xl">
          <Loader aria-label={t.auth.loadingProfile} />
        </Center>
      </main>
    )
  }
  if (error) {
    return (
      <main className="page">
        <Alert color="red" variant="light">
          {error}
        </Alert>
      </main>
    )
  }
  if (!firebaseUser || !profile) {
    return (
      <main className="page">
        <Center py="xl">
          <Loader aria-label={t.auth.redirecting} />
        </Center>
      </main>
    )
  }
  if (adminOnly && profile.role !== "ADMIN") {
    return (
      <main className="page">
        <Alert color="red" variant="light">
          {t.auth.adminRequired}
        </Alert>
      </main>
    )
  }
  return <>{children}</>
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const { profile, logout } = useAuth()
  const pathname = usePathname()
  const links = [
    { href: "/matches", label: t.nav.matches },
    { href: "/my-bets", label: t.nav.myBets },
    { href: "/leaderboard", label: t.nav.leaderboard },
    ...(profile?.role === "ADMIN" ? [{ href: "/admin", label: t.nav.admin }] : []),
  ]

  if (pathname === "/login") return <>{children}</>

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/matches" className="brand-link">
            World Cup Bets
          </Link>
          <nav className="app-nav">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${pathname.startsWith(link.href) ? "nav-link-active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {profile ? (
            <div className="account-strip">
              <LanguageSwitch />
              <span className="account-name">{profile.displayName}</span>
              <button className="button secondary !py-2" onClick={logout}>
                {t.auth.signOut}
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <AppBackButton />
      {children}
    </>
  )
}

function AppBackButton() {
  const { t } = useI18n()
  const pathname = usePathname()
  const router = useRouter()
  const currentPathRef = useRef<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)

  useEffect(() => {
    if (currentPathRef.current && currentPathRef.current !== pathname) {
      setCanGoBack(true)
    }
    currentPathRef.current = pathname
  }, [pathname])

  if (!canGoBack) return null

  return (
    <div className="app-back-bar">
      <button className="app-back-button" type="button" onClick={() => router.back()}>
        &lt; {t.nav.back}
      </button>
    </div>
  )
}
