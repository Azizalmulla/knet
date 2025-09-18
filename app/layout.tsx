import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono, IBM_Plex_Sans_Arabic } from "next/font/google"
import { FORM_TITLE, FORM_DESCRIPTION, COMPANY_NAME } from "@/lib/constants"
import "./globals.css"
import { V0Provider } from "@/lib/context"
import dynamic from "next/dynamic"
import { LanguageProvider } from "@/lib/language"
import LanguageToggle from "@/components/language-toggle"
import { ThemeProvider } from "@/components/theme-provider"
import AppToaster from "@/components/ui/sonner-toaster"

const V0Setup = dynamic(() => import("@/components/v0-setup"))

const isV0 = process.env["VERCEL_URL"]?.includes("vusercontent.net") ?? false

const interSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
})

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const ibmArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"]
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${interSans.variable} ${jetBrainsMono.variable} ${ibmArabic.variable} antialiased font-sans font-medium transition-colors duration-300`} suppressHydrationWarning>
        <ThemeProvider>
          <V0Provider isV0={isV0}>
            <LanguageProvider>
              {children}
              <div className="no-print">
                <LanguageToggle />
                <AppToaster />
              </div>
            </LanguageProvider>
            {isV0 && <V0Setup />}
          </V0Provider>
        </ThemeProvider>
      </body>
    </html>
  )
}
