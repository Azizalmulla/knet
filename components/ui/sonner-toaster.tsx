"use client"

import * as React from "react"
import { Toaster } from "sonner"

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      duration={3000}
      theme="system"
      closeButton
    />
  )
}
