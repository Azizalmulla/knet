export async function adminFetch(path: string, init: RequestInit = {}) {
  const getToken = () => {
    if (typeof window === 'undefined') return null;
    const ls = window.localStorage?.getItem('admin_token');
    if (ls && ls.trim().length) return ls.trim();
    const ss = window.sessionStorage?.getItem('admin_token');
    return ss ? ss.trim() : null;
  };

  const token = getToken();

  // Build headers and store last request for potential retry after re-auth
  const headers: Record<string, string> = {
    'x-admin-key': token || '',
    ...(init.headers as Record<string, string> | undefined),
  };

  // Ensure JSON content-type when sending a body string
  const hasBody = typeof init.body === 'string' && (init.body as string).length > 0;
  if (hasBody && !('content-type' in Object.fromEntries(Object.entries(headers).map(([k,v]) => [k.toLowerCase(), v])))) {
    headers['content-type'] = 'application/json';
  }

  // Persist last request for possible retry after inline auth
  if (typeof window !== 'undefined') {
    const body = hasBody ? (init.body as string) : (
      // @ts-ignore
      init?.body ? JSON.stringify(init.body) : undefined
    );
    // @ts-ignore
    window.__last_admin_request = { path, init: { ...init, headers, body } };
  }

  async function attemptFetch(abortMs = 30000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), abortMs);
    try {
      const res = await fetch(path, {
        ...init,
        headers,
        cache: 'no-store',
        credentials: 'same-origin',
        keepalive: true,
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401 && typeof window !== 'undefined') {
          try { window.dispatchEvent(new CustomEvent('admin-auth-required')); } catch {}
        }
        const err = new Error(`ADMIN_FETCH_${res.status}`);
        // @ts-ignore add status for callers
        err.status = res.status;
        throw err;
      }

      // Try JSON first; fall back to text to avoid parse errors surfacing as network failures
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return res.json();
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { ok: true, text }; }
    } finally {
      clearTimeout(t);
    }
  }

  // Primary attempt
  try {
    return await attemptFetch(30000);
  } catch (err: any) {
    // Auto-retry once on transient network failures
    const msg = String(err?.message || '');
    const isTransient = msg.includes('Failed to fetch') || msg.includes('network') || msg.includes('abort');
    if (isTransient) {
      await new Promise(r => setTimeout(r, 250));
      return await attemptFetch(30000);
    }
    throw err;
  }
}
