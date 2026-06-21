"use client"

import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { auth } from "@/lib/firebase/client"

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
  loginWithEmail: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<Profile>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiFetch = useMemo(
    () => async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const token = await auth.currentUser?.getIdToken()
      const headers = new Headers(init.headers)
      if (token) headers.set("authorization", `Bearer ${token}`)
      if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json")
      return fetch(input, { ...init, headers })
    },
    [],
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
    loginWithEmail: async (email, password) => {
      setLoading(true)
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password)
        setFirebaseUser(credential.user)
        await loadProfileForUser(credential.user)
      } finally {
        setLoading(false)
      }
    },
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
  const { firebaseUser, profile, loading, error } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login")
  }, [firebaseUser, loading, router])

  if (loading) return <div className="page">Loading...</div>
  if (error) return <div className="page panel p-5 text-red-700">{error}</div>
  if (!firebaseUser || !profile) return <div className="page">Redirecting...</div>
  if (adminOnly && profile.role !== "ADMIN") {
    return <div className="page panel p-5 text-red-700">Admin access required.</div>
  }
  return <>{children}</>
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, logout } = useAuth()
  const pathname = usePathname()
  const links = [
    { href: "/matches", label: "Matches" },
    { href: "/my-bets", label: "My bets" },
    { href: "/leaderboard", label: "Leaderboard" },
    ...(profile?.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ]

  if (pathname === "/login") return <>{children}</>

  return (
    <>
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex w-[min(1180px,calc(100vw-32px))] flex-wrap items-center justify-between gap-3 py-3">
          <Link href="/matches" className="text-lg font-black">
            World Cup Bets
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-bold ${
                  pathname.startsWith(link.href) ? "bg-teal-700 text-white" : "text-stone-700"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {profile ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold">{profile.displayName}</span>
              <button className="button secondary !py-2" onClick={logout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </>
  )
}
