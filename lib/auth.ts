import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

// Export a wrapper for getServerSession for compatibility
export const getServerSession = auth
