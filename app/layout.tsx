import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { FORM_TITLE, FORM_DESCRIPTION, COMPANY_NAME } from "@/lib/constants"
import "./globals.css"
import { V0Provider } from "@/lib/context"
import dynamic from "next/dynamic"

const V0Setup = dynamic(() => import("@/components/v0-setup"))

const isV0 = process.env["VERCEL_URL"]?.includes("vusercontent.net") ?? false

const interSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: COMPANY_NAME + " | " + FORM_TITLE,
  description: FORM_DESCRIPTION,
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${interSans.variable} ${jetBrainsMono.variable} antialiased`} suppressHydrationWarning>
        <V0Provider isV0={isV0}>
          {children}
          {isV0 && <V0Setup />}
        </V0Provider>
      </body>
    </html>
  )
}
