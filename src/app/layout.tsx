import type { Metadata } from "next"
import { AppShell, AuthProvider } from "@/components/auth-provider"
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
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
