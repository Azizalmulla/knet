import { NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id"
import EmailProvider from "next-auth/providers/email"
import { sql } from '@/lib/db'

// Helper to send email via Resend
async function sendVerificationRequest({
  identifier: email,
  url,
  provider,
}: {
  identifier: string
  url: string
  provider: any
}) {
  const { host } = new URL(url)
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Wathefni AI <onboarding@resend.dev>",
      to: [email],
      subject: `Sign in to Wathefni AI`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #ffffff; }
              .header { text-align: center; padding: 30px 0; }
              .logo { font-size: 32px; font-weight: bold; color: #ffffff; }
              .content { background: #1a1a1a; border-radius: 12px; padding: 30px; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 24px; background: #ffffff; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; padding: 20px 0; }
              a { color: #ffffff; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">Wathefni AI</div>
              </div>
              <div class="content">
                <h2 style="margin-top: 0;">Sign in to your account</h2>
                <p>Click the button below to sign in to Wathefni AI. This link will expire in 15 minutes.</p>
                <div style="text-align: center;">
                  <a href="${url}" class="button">Sign in to Wathefni AI</a>
                </div>
                <p style="color: #888; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Wathefni AI. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Sign in to Wathefni AI\n\nClick the link below to sign in:\n${url}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this email, you can safely ignore it.`,
    }),
  })

  if (!res.ok) {
    throw new Error(`Email send failed: ${res.statusText}`)
  }
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    MicrosoftEntraId({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
    }),
    // EmailProvider temporarily disabled - requires database adapter
    // Will re-enable with proper adapter configuration
  ],
  pages: {
    signIn: "/student/login",
    error: "/student/login",
    verifyRequest: "/student/verify",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Upsert student user
      if (user.email) {
        try {
          await sql`
            INSERT INTO student_users (email, email_lc, name, avatar_url)
            VALUES (${user.email}, ${user.email.toLowerCase()}, ${user.name}, ${user.image})
            ON CONFLICT (email) DO UPDATE
            SET name = COALESCE(EXCLUDED.name, student_users.name),
                avatar_url = COALESCE(EXCLUDED.avatar_url, student_users.avatar_url)
          `
        } catch (error) {
          console.error("Failed to upsert student user:", error)
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.uid = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        token.roles = ["student"]
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.uid as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.picture as string
        ;(session as any).roles = token.roles || ["student"]
      }
      return session
    },
  },
}
