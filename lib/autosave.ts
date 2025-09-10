/**
 * Local draft autosave utility with debouncing for AI CV Builder
 */

import { useEffect, useRef, useCallback } from 'react';
import { UseFormWatch } from 'react-hook-form';

const AUTOSAVE_KEY = 'knet_cv_draft';
const AUTOSAVE_DEBOUNCE_MS = 5000; // 5 seconds
const AUTOSAVE_DISABLED = process.env.NEXT_PUBLIC_DISABLE_AUTOSAVE === 'true';

export interface AutosaveOptions {
  disabled?: boolean;
  debounceMs?: number;
  storageKey?: string;
}

/**
 * Hook for autosaving form data to localStorage with debouncing
 */
export function useAutosave(
  watch: UseFormWatch<any>,
  options: AutosaveOptions = {}
) {
  const {
    disabled = AUTOSAVE_DISABLED,
    debounceMs = AUTOSAVE_DEBOUNCE_MS,
    storageKey = AUTOSAVE_KEY
  } = options;

  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<string>('');

  const saveToStorage = useCallback((data: any) => {
    if (disabled || typeof window === 'undefined') return;

    try {
      const serialized = JSON.stringify({
        data,
        timestamp: Date.now(),
        version: '1.0'
      });

      // Only save if data has actually changed
      if (serialized !== lastSavedRef.current) {
        localStorage.setItem(storageKey, serialized);
        lastSavedRef.current = serialized;
        console.log('🔄 Draft autosaved at', new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.warn('Failed to save draft:', error);
    }
  }, [disabled, storageKey]);

  const debouncedSave = useCallback((data: any) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveToStorage(data);
    }, debounceMs);
  }, [saveToStorage, debounceMs]);

  useEffect(() => {
    if (disabled) return;

    const subscription = watch((data) => {
      // Skip if data is empty or only has default values
      if (!data || Object.keys(data).length === 0) return;
      
      // Skip if no meaningful data (just empty strings)
      const hasContent = Object.values(data).some(value => {
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (value && typeof value === 'object') return Object.keys(value).length > 0;
        return Boolean(value);
      });

      if (hasContent) {
        debouncedSave(data);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [watch, debouncedSave, disabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}

/**
 * Load saved draft from localStorage
 */
export function loadDraft(storageKey: string = AUTOSAVE_KEY): any | null {
  // Check environment variable dynamically for tests
  const isDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTOSAVE === 'true';
  if (isDisabled || typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    
    // Check if draft is not too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - parsed.timestamp > maxAge) {
      localStorage.removeItem(storageKey);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.warn('Failed to load draft:', error);
    return null;
  }
}

/**
 * Clear saved draft from localStorage
 */
export function clearDraft(storageKey: string = AUTOSAVE_KEY): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(storageKey);
    console.log('🗑️  Draft cleared');
  } catch (error) {
    console.warn('Failed to clear draft:', error);
  }
}

/**
 * Check if there's a saved draft available
 */
export function hasDraft(storageKey: string = AUTOSAVE_KEY): boolean {
  return loadDraft(storageKey) !== null;
}

/**
 * Get draft metadata (timestamp, etc.)
 */
export function getDraftInfo(storageKey: string = AUTOSAVE_KEY): { timestamp: number; age: string } | null {
  if (AUTOSAVE_DISABLED || typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    const timestamp = parsed.timestamp;
    const ageMs = Date.now() - timestamp;
    const ageMinutes = Math.floor(ageMs / (1000 * 60));
    
    let age: string;
    if (ageMinutes < 1) {
      age = 'less than a minute ago';
    } else if (ageMinutes < 60) {
      age = `${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} ago`;
    } else {
      const ageHours = Math.floor(ageMinutes / 60);
      age = `${ageHours} hour${ageHours === 1 ? '' : 's'} ago`;
    }

    return { timestamp, age };
  } catch (error) {
    return null;
  }
}
