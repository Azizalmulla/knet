export async function adminFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
  
  const res = await fetch(path, { 
    ...init, 
    headers: { 
      ...(init.headers || {}), 
      Authorization: `Bearer ${token || ''}` 
    } 
  });
  
  if (!res.ok) {
    // Handle 401 unauthorized - session expired
    if (res.status === 401 && typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_token');
      
      // Show toast notification if available
      if (window.location.pathname.startsWith('/admin')) {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.textContent = 'Session expired—please log in again.';
        toast.style.cssText = `
          position: fixed; top: 20px; right: 20px; z-index: 9999;
          background: #f56565; color: white; padding: 12px 24px;
          border-radius: 8px; font-size: 14px; font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(toast);
        
        // Auto-remove toast and reload page after 3 seconds
        setTimeout(() => {
          toast.remove();
          window.location.reload();
        }, 3000);
      }
    }
    
    throw new Error(`ADMIN_FETCH_${res.status}`);
  }
  
  return res.json();
}
