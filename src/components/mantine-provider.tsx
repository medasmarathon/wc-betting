"use client"

import { MantineProvider } from "@mantine/core"

export function UiProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={{
        primaryColor: "teal",
        defaultRadius: "md",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {children}
    </MantineProvider>
  )
}
