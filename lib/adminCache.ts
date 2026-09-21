/**
 * Outflank Admin High-Performance Cache Layer
 * Provides TTL-aware browser caching (session & local storage)
 * to eliminate redundant network roundtrips during admin navigation.
 */

interface CacheEnvelope<T> {
  data: T;
  timestamp: number;
}

export interface CacheResult<T> {
  data: T;
  isStale: boolean;
  ageMs: number;
}

/**
 * Retrieve cached data with TTL check.
 * @param key Unique cache key
 * @param maxAgeMs Maximum lifetime in milliseconds before data is considered stale (default: 5 minutes)
 * @param storage 'session' (default, lasts during browser session) | 'local'
 */
export function getAdminCache<T>(
  key: string,
  maxAgeMs = 5 * 60 * 1000,
  storage: 'session' | 'local' = 'session'
): CacheResult<T> | null {
  if (typeof window === 'undefined') return null;

  try {
    const store = storage === 'session' ? window.sessionStorage : window.localStorage;
    const item = store.getItem(key);
    if (!item) return null;

    const envelope: CacheEnvelope<T> = JSON.parse(item);
    if (!envelope || typeof envelope !== 'object' || !('data' in envelope) || !('timestamp' in envelope)) {
      return null;
    }

    const ageMs = Date.now() - envelope.timestamp;
    const isStale = ageMs > maxAgeMs;

    return {
      data: envelope.data,
      isStale,
      ageMs,
    };
  } catch {
    return null;
  }
}

/**
 * Save data to cache with current timestamp.
 */
export function setAdminCache<T>(
  key: string,
  data: T,
  storage: 'session' | 'local' = 'session'
): void {
  if (typeof window === 'undefined') return;

  try {
    const store = storage === 'session' ? window.sessionStorage : window.localStorage;
    const envelope: CacheEnvelope<T> = {
      data,
      timestamp: Date.now(),
    };
    store.setItem(key, JSON.stringify(envelope));
  } catch (err) {
    console.warn('[adminCache] Storage write error:', err);
  }
}

/**
 * Remove a single cache key.
 */
export function removeAdminCache(
  key: string,
  storage: 'session' | 'local' = 'session'
): void {
  if (typeof window === 'undefined') return;
  try {
    const store = storage === 'session' ? window.sessionStorage : window.localStorage;
    store.removeItem(key);
  } catch {}
}

/**
 * Clear all outflank admin cache keys across both session and local storage.
 */
export function clearAllAdminCache(): void {
  if (typeof window === 'undefined') return;

  try {
    // Clear session storage keys
    const sessionKeys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith('outflank_admin_')) {
        sessionKeys.push(k);
      }
    }
    sessionKeys.forEach((k) => window.sessionStorage.removeItem(k));

    // Clear local storage keys
    const localKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('outflank_admin_')) {
        localKeys.push(k);
      }
    }
    localKeys.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
}
