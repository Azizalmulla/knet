import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export type PresignResult = { url: string; expiresAt: number }

// Support both legacy and current env var names for Vercel Blob token
const providerEnv = (process.env.STORAGE_PROVIDER || '').toLowerCase()
const vercelBlobToken = process.env.VERCEL_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN
// Auto-detect provider as 'vercel' if token exists but STORAGE_PROVIDER is unset
const provider = providerEnv || (vercelBlobToken ? 'vercel' : '')

export async function getPresignedUrl(key: string, ttlSeconds = 60): Promise<PresignResult> {
  if (!key || !key.trim()) {
    throw new Error('MISSING_KEY')
  }

  // Normalize key for provider
  let k = key.trim()
  try {
    const providerHint = provider
    if (/^https?:\/\//i.test(k)) {
      const u = new URL(k)
      let path = u.pathname.replace(/^\/+/, '')
      // Supabase public URL form: storage/v1/object/public/<bucket>/<key>
      if (providerHint !== 'vercel') {
        if (path.startsWith('storage/v1/object/public/')) {
          path = path.substring('storage/v1/object/public/'.length)
        }
        const bucket = process.env.SUPABASE_BUCKET || 'cv-uploads'
        if (path.startsWith(bucket + '/')) {
          path = path.substring(bucket.length + 1)
        }
      }
      k = path
    } else if (providerHint !== 'vercel') {
      // For Supabase, ensure key is bucket-internal (remove accidental bucket prefix)
      const bucket = process.env.SUPABASE_BUCKET || 'cv-uploads'
      if (k.startsWith(bucket + '/')) {
        k = k.substring(bucket.length + 1)
      }
    }
  } catch {
    // leave k as-is
  }

  // Decide attempt order:
  // 1) If explicitly set to 'vercel', try Vercel then fallback to Supabase
  // 2) If explicitly set to 'supabase', try Supabase then fallback to Vercel
  // 3) If not set, try Vercel when token exists, otherwise try Supabase

  const tryVercel = async (): Promise<PresignResult> => {
    const token = vercelBlobToken
    if (!token) throw new Error('VERCEL_BLOB_TOKEN_MISSING')
    // For Vercel Blob, the URL is already public - just return it with short TTL
    // Vercel Blob URLs are like: https://*.public.blob.vercel-storage.com/path
    // They don't expire, but we treat them as short-lived for consistency
    if (/^https:\/\/.*\.public\.blob\.vercel-storage\.com\//i.test(k)) {
      return { url: k, expiresAt: Date.now() + ttlSeconds * 1000 }
    }
    // If it's a pathname, construct the full URL
    const baseUrl = `https://${token.split('_')[0]}.public.blob.vercel-storage.com`
    const fullUrl = k.startsWith('/') ? `${baseUrl}${k}` : `${baseUrl}/${k}`
    return { url: fullUrl, expiresAt: Date.now() + ttlSeconds * 1000 }
  }

  const trySupabase = async (): Promise<PresignResult> => {
    const url = process.env.SUPABASE_URL
    const service = process.env.SUPABASE_SERVICE_ROLE
    const bucket = process.env.SUPABASE_BUCKET || 'cv-uploads'
    if (!url || !service) throw new Error('SUPABASE_NOT_CONFIGURED')
    const supabase = createSupabaseClient(url, service)
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(k, ttlSeconds)
    if (error || !data?.signedUrl) throw new Error('PRESIGN_FAILED')
    return { url: data.signedUrl, expiresAt: Date.now() + ttlSeconds * 1000 }
  }

  const explicit = provider
  if (explicit === 'vercel') {
    try {
      return await tryVercel()
    } catch {
      // fallback
      return await trySupabase()
    }
  }
  if (explicit === 'supabase') {
    try {
      return await trySupabase()
    } catch {
      return await tryVercel()
    }
  }

  // Auto mode
  if (vercelBlobToken) {
    try {
      return await tryVercel()
    } catch (vercelErr: any) {
      console.log('[STORAGE] Vercel failed, trying Supabase:', vercelErr?.message)
      try {
        return await trySupabase()
      } catch (supaErr: any) {
        console.error('[STORAGE] Both providers failed:', { vercel: vercelErr?.message, supabase: supaErr?.message })
        throw supaErr
      }
    }
  }
  // Default to Supabase first
  try {
    return await trySupabase()
  } catch (supaErr: any) {
    console.log('[STORAGE] Supabase failed, trying Vercel:', supaErr?.message)
    try {
      return await tryVercel()
    } catch (vercelErr: any) {
      console.error('[STORAGE] Both providers failed:', { supabase: supaErr?.message, vercel: vercelErr?.message })
      throw vercelErr
    }
  }
}
