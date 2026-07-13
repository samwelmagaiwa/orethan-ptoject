/**
 * Single source of truth for the API base URL.
 * Set VITE_API_URL in .env / .env.production to point at a different backend.
 * Default: local Laravel dev server.
 */
export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

/** Backend origin without the /api/v1 path -- used for resolving file/storage URLs. */
export const BASE_URL = API_BASE.replace(/\/api\/v1\/?$/, "");

/**
 * Base URL for resolving Laravel /storage/* file paths.
 * On live the backend public dir lives at /api/, so storage symlink is at /api/storage/.
 * VITE_STORAGE_BASE lets .env.production override to https://domain.com/api
 * On local artisan serve the storage is at the root, so falls back to BASE_URL.
 */
export const STORAGE_BASE: string = (() => {
  if (import.meta.env.VITE_STORAGE_BASE) return import.meta.env.VITE_STORAGE_BASE as string;
  return BASE_URL;
})();

/**
 * Resolve any backend photo/document URL to a fully-qualified URL.
 * Handles: relative /storage/* paths, absolute URLs with wrong origin
 * (e.g. http://127.0.0.1:8000 stored from local dev), data: and blob: URLs.
 */
export function resolveStorageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http')) {
    // Fix URLs that were saved with the local dev origin (127.0.0.1)
    const localOrigins = ['http://127.0.0.1:8000', 'http://localhost:8000', 'http://127.0.0.1'];
    for (const wrong of localOrigins) {
      if (url.startsWith(wrong)) {
        return STORAGE_BASE + url.slice(wrong.length);
      }
    }
    return url;
  }
  return `${STORAGE_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Format a loan ID as a zero-padded 5-digit string, e.g. 1 → "00001" */
export const fmtLoanId = (id: number | string | null | undefined): string =>
  String(id ?? 0).padStart(5, "0");
