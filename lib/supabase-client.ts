import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookies = document.cookie.split('; ')
          const cookie = cookies.find(c => c.startsWith(`${name}=`))
          return cookie?.split('=')[1]
        },
        set(name: string, value: string, options: any) {
          // Set cookie domain to root domain in production so cookies work across wathefni.ai and www.wathefni.ai
          const isProduction = typeof window !== 'undefined' && 
            (window.location.hostname.includes('wathefni'))
          
          const domain = isProduction ? '.wathefni.ai' : undefined
          
          let cookie = `${name}=${value}`
          if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
          if (options?.expires) cookie += `; expires=${new Date(options.expires).toUTCString()}`
          if (options?.path) cookie += `; path=${options.path}`
          if (domain) cookie += `; domain=${domain}`
          if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
          if (options?.secure) cookie += '; secure'
          
          document.cookie = cookie
        },
        remove(name: string, options: any) {
          const isProduction = typeof window !== 'undefined' && 
            (window.location.hostname.includes('wathefni'))
          
          const domain = isProduction ? '.wathefni.ai' : undefined
          
          let cookie = `${name}=; max-age=0`
          if (options?.path) cookie += `; path=${options.path}`
          if (domain) cookie += `; domain=${domain}`
          
          document.cookie = cookie
        },
      },
    }
  )
}
