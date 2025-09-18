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

  if (typeof window !== 'undefined') {
    // Store a shallow-cloned init for retry; ensure body is stringified
    const body = (init && typeof init.body === 'string') ? init.body : (
      // @ts-ignore
      init?.body ? JSON.stringify(init.body) : undefined
    );
    // @ts-ignore
    window.__last_admin_request = { path, init: { ...init, headers, body } };
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      try {
        // Keep tokens as-is; let admin decide to re-enter. Notify UI to show inline modal.
        const evt = new CustomEvent('admin-auth-required');
        window.dispatchEvent(evt);
      } catch {}
    }
    const err = new Error(`ADMIN_FETCH_${res.status}`);
    // @ts-ignore add status code for callers
    err.status = res.status;
    throw err;
  }

  return res.json();
}
