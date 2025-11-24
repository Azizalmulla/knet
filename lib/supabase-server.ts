import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerClient() {
  const cookieStore = cookies()

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Set cookie domain to root domain in production so cookies work across wathefni.ai and www.wathefni.ai
              const isProduction = process.env.NODE_ENV === 'production' && 
                (process.env.VERCEL_URL?.includes('wathefni') || process.env.NEXT_PUBLIC_SITE_URL?.includes('wathefni'))
              
              const cookieOptions = isProduction 
                ? { ...options, domain: '.wathefni.ai' }
                : options
              
              cookieStore.set(name, value, cookieOptions)
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
