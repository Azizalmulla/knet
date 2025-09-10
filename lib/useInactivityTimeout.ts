"use client";

import { useEffect, useRef } from 'react';

interface UseInactivityTimeoutOptions {
  timeoutMs: number;
  onTimeout: () => void;
  enabled?: boolean;
}

export function useInactivityTimeout({ 
  timeoutMs, 
  onTimeout, 
  enabled = true 
}: UseInactivityTimeoutOptions) {
  // Timer reference (works in both browser and Node typings)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current as any);
    }
    
    if (enabled) {
      timeoutRef.current = setTimeout(() => {
        onTimeout();
      }, timeoutMs);
    }
  };

  const clearInactivityTimeout = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!enabled) {
      clearInactivityTimeout();
      return;
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Start the timeout
    resetTimeout();

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimeout, { passive: true });
    });

    // Cleanup on unmount
    return () => {
      clearInactivityTimeout();
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, [timeoutMs, onTimeout, enabled]);

  return { resetTimeout, clearInactivityTimeout };
}
