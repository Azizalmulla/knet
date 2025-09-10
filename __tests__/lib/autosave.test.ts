import { renderHook, act } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { useAutosave, loadDraft, clearDraft, hasDraft, getDraftInfo } from '@/lib/autosave';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('Autosave Utility', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
  });

  describe('useAutosave hook', () => {
    test('does not save when disabled', () => {
      const { result } = renderHook(() => useForm());
      const form = result.current;

      renderHook(() => useAutosave(form.watch, { disabled: true }));

      act(() => {
        form.setValue('name', 'John Doe');
      });

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(mockLocalStorage.getItem('knet_cv_draft')).toBeNull();
    });

    test('saves data after debounce period', () => {
      const { result } = renderHook(() => useForm());
      const form = result.current;

      renderHook(() => useAutosave(form.watch, { disabled: false }));

      act(() => {
        form.setValue('name', 'John Doe');
        form.setValue('email', 'john@example.com');
      });

      // Should not save immediately
      expect(mockLocalStorage.getItem('knet_cv_draft')).toBeNull();

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should save after debounce
      const saved = mockLocalStorage.getItem('knet_cv_draft');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed.data.name).toBe('John Doe');
      expect(parsed.data.email).toBe('john@example.com');
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.version).toBe('1.0');
    });

    test('debounces multiple rapid changes', () => {
      const { result } = renderHook(() => useForm());
      const form = result.current;

      renderHook(() => useAutosave(form.watch, { disabled: false }));

      act(() => {
        form.setValue('name', 'John');
        jest.advanceTimersByTime(2000);
        form.setValue('name', 'John Doe');
        jest.advanceTimersByTime(2000);
        form.setValue('name', 'John Smith');
      });

      // Should not have saved yet
      expect(mockLocalStorage.getItem('knet_cv_draft')).toBeNull();

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should only save the final value
      const saved = JSON.parse(mockLocalStorage.getItem('knet_cv_draft')!);
      expect(saved.data.name).toBe('John Smith');
    });

    test('does not save empty or meaningless data', () => {
      const { result } = renderHook(() => useForm());
      const form = result.current;

      renderHook(() => useAutosave(form.watch, { disabled: false }));

      act(() => {
        form.setValue('name', '');
        form.setValue('email', '   ');
      });

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(mockLocalStorage.getItem('knet_cv_draft')).toBeNull();
    });

    test('uses custom storage key', () => {
      const { result } = renderHook(() => useForm());
      const form = result.current;
      const customKey = 'custom_draft_key';

      renderHook(() => useAutosave(form.watch, { 
        disabled: false, 
        storageKey: customKey 
      }));

      act(() => {
        form.setValue('name', 'Test User');
      });

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockLocalStorage.getItem(customKey)).toBeTruthy();
      expect(mockLocalStorage.getItem('knet_cv_draft')).toBeNull();
    });
  });

  describe('loadDraft function', () => {
    test('loads valid draft data', () => {
      const testData = { name: 'John Doe', email: 'john@example.com' };
      const draftData = {
        data: testData,
        timestamp: Date.now(),
        version: '1.0'
      };

      mockLocalStorage.setItem('knet_cv_draft', JSON.stringify(draftData));

      const loaded = loadDraft();
      expect(loaded).toEqual(testData);
    });

    test('returns null when no draft exists', () => {
      const loaded = loadDraft();
      expect(loaded).toBeNull();
    });

    test('returns null for expired draft', () => {
      const testData = { name: 'John Doe' };
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const draftData = {
        data: testData,
        timestamp: expiredTimestamp,
        version: '1.0'
      };

      mockLocalStorage.setItem('knet_cv_draft', JSON.stringify(draftData));

      const loaded = loadDraft();
      expect(loaded).toBeNull();
      expect(mockLocalStorage.getItem('knet_cv_draft')).toBeNull(); // Should be removed
    });

    test('handles corrupted draft data', () => {
      mockLocalStorage.setItem('knet_cv_draft', 'invalid json');

      const loaded = loadDraft();
      expect(loaded).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith('Failed to load draft:', expect.any(Error));
    });

    test('respects disabled environment variable', () => {
      // Mock environment variable
      const originalEnv = process.env.NEXT_PUBLIC_DISABLE_AUTOSAVE;
      process.env.NEXT_PUBLIC_DISABLE_AUTOSAVE = 'true';

      const testData = { name: 'John Doe' };
      const draftData = {
        data: testData,
        timestamp: Date.now(),
        version: '1.0'
      };

      mockLocalStorage.setItem('knet_cv_draft', JSON.stringify(draftData));

      const loaded = loadDraft();
      expect(loaded).toBeNull();

      // Restore environment
      process.env.NEXT_PUBLIC_DISABLE_AUTOSAVE = originalEnv;
    });
  });

  describe('clearDraft function', () => {
    test('removes draft from storage', () => {
      mockLocalStorage.setItem('knet_cv_draft', 'test data');
      
      clearDraft();
      
      expect(mockLocalStorage.getItem('knet_cv_draft')).toBeNull();
    });

    test('handles missing draft gracefully', () => {
      expect(() => clearDraft()).not.toThrow();
    });
  });

  describe('hasDraft function', () => {
    test('returns true when valid draft exists', () => {
      const draftData = {
        data: { name: 'John' },
        timestamp: Date.now(),
        version: '1.0'
      };

      mockLocalStorage.setItem('knet_cv_draft', JSON.stringify(draftData));

      expect(hasDraft()).toBe(true);
    });

    test('returns false when no draft exists', () => {
      expect(hasDraft()).toBe(false);
    });

    test('returns false for expired draft', () => {
      const expiredDraft = {
        data: { name: 'John' },
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        version: '1.0'
      };

      mockLocalStorage.setItem('knet_cv_draft', JSON.stringify(expiredDraft));

      expect(hasDraft()).toBe(false);
    });
  });

  describe('getDraftInfo function', () => {
    test('returns draft info for valid draft', () => {
      const timestamp = Date.now() - (30 * 60 * 1000); // 30 minutes ago
      const draftData = {
        data: { name: 'John' },
        timestamp,
        version: '1.0'
      };

      mockLocalStorage.setItem('knet_cv_draft', JSON.stringify(draftData));

      const info = getDraftInfo();
      expect(info).toEqual({
        timestamp,
        age: '30 minutes ago'
      });
    });

    test('formats age correctly for different time periods', () => {
      // Test less than 1 minute
      let timestamp = Date.now() - (30 * 1000); // 30 seconds ago
      let draftData = { data: { name: 'John' }, timestamp, version: '1.0' };
      mockLocalStorage.setItem('knet_cv_draft', JSON.stringify(draftData));
      
      let info = getDraftInfo();
      expect(info?.age).toBe('less than a minute ago');

      // Test 1 minute
      timestamp = Date.now() - (60 * 1000); // 1 minute ago
      draftData = { data: { name: 'John' }, timestamp, version: '1.0' };
      mockLocalStorage.setItem('knet_cv_draft', JSON.stringify(draftData));
      
      info = getDraftInfo();
      expect(info?.age).toBe('1 minute ago');

      // Test multiple hours
      timestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      draftData = { data: { name: 'John' }, timestamp, version: '1.0' };
      mockLocalStorage.setItem('knet_cv_draft', JSON.stringify(draftData));
      
      info = getDraftInfo();
      expect(info?.age).toBe('2 hours ago');
    });

    test('returns null when no draft exists', () => {
      const info = getDraftInfo();
      expect(info).toBeNull();
    });
  });
});
