"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  DEFAULT_LOCALE,
  INTL_LOCALES,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  type Locale,
  messages,
  normalizeLocale,
} from "@/lib/i18n"

type LanguageContextValue = {
  locale: Locale
  intlLocale: string
  t: (typeof messages)[Locale]
  setLocale: (locale: Locale) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const storedLocale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY))
    window.requestAnimationFrame(() => setLocaleState(storedLocale))
  }, [])

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale)
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
  }

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(
    () => ({
      locale,
      intlLocale: INTL_LOCALES[locale],
      t: messages[locale],
      setLocale,
    }),
    [locale],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useI18n must be used within LanguageProvider")
  return context
}

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="language-switch" aria-label={t.nav.language}>
      {(Object.keys(LOCALE_LABELS) as Locale[]).map((option) => (
        <button
          key={option}
          type="button"
          className="language-switch-option"
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
        >
          {LOCALE_LABELS[option]}
        </button>
      ))}
    </div>
  )
}
