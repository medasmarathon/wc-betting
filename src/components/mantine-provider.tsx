"use client"

import { MantineProvider } from "@mantine/core"

export function UiProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={{
        colors: {
          stadium: [
            "#e6f3f0",
            "#cce6e1",
            "#9acdc4",
            "#66b0a5",
            "#3a988c",
            "#1d8578",
            "#087568",
            "#065e55",
            "#064f48",
            "#03342f",
          ],
        },
        primaryColor: "stadium",
        primaryShade: 6,
        defaultRadius: "sm",
        fontFamily: "var(--font-app), Arial, Helvetica, sans-serif",
      }}
    >
      {children}
    </MantineProvider>
  )
}
