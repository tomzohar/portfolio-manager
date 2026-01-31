import { randomUUID } from 'crypto';

/**
 * A2UI Backend Utilities
 */

/**
 * Ensures component name is capitalized.
 */
export function normalizeComponentName(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Generates a UUID for a component if missing.
 */
export function ensureComponentId(id?: string): string {
  return id || randomUUID();
}

/**
 * Simple JSON Pointer resolution for backend (for internal normalization).
 */
export function resolveDataPath(
  obj: Record<string, unknown>,
  path: string,
): any {
  if (!path || path === '/' || path === '') return obj;
  const parts = path.split('/').filter((p) => p !== '');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
