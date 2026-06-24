import type { Metadata } from "next"
import { LanguageProvider } from "@/components/language-provider"
import { UiProvider } from "@/components/mantine-provider"
import { AppShell, AuthProvider } from "@/components/auth-provider"
import { DEFAULT_LOCALE, messages } from "@/lib/i18n"
import "@mantine/core/styles.css"
import "flag-icons/css/flag-icons.min.css"
import "./globals.css"

export const metadata: Metadata = {
  title: messages[DEFAULT_LOCALE].app.name,
  description: messages[DEFAULT_LOCALE].app.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body>
        <UiProvider>
          <LanguageProvider>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </LanguageProvider>
        </UiProvider>
      </body>
    </html>
  )
}
