import type { Metadata } from "next"
import { Be_Vietnam_Pro } from "next/font/google"
import { LanguageProvider } from "@/components/language-provider"
import { UiProvider } from "@/components/mantine-provider"
import { AppShell, AuthProvider } from "@/components/auth-provider"
import { DEFAULT_LOCALE, messages } from "@/lib/i18n"
import "@mantine/core/styles.css"
import "flag-icons/css/flag-icons.min.css"
import "./globals.css"

const appFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-app",
})

export const metadata: Metadata = {
  title: messages[DEFAULT_LOCALE].app.name,
  description: messages[DEFAULT_LOCALE].app.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body className={appFont.variable}>
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
