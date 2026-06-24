import type { Metadata } from "next"
import { UiProvider } from "@/components/mantine-provider"
import { AppShell, AuthProvider } from "@/components/auth-provider"
import "@mantine/core/styles.css"
import "flag-icons/css/flag-icons.min.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "World Cup Bets",
  description: "Private points-only World Cup betting pool",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UiProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </UiProvider>
      </body>
    </html>
  )
}
