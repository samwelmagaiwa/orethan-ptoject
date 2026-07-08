/**
 * Single source of truth for the API base URL.
 * Set VITE_API_URL in .env / .env.production to point at a different backend.
 * Default: local Laravel dev server.
 */
export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

/** Backend origin without the /api/v1 path -- used for resolving file/storage URLs. */
export const BASE_URL = API_BASE.replace(/\/api\/v1\/?$/, "");

/** Format a loan ID as a zero-padded 5-digit string, e.g. 1 → "00001" */
export const fmtLoanId = (id: number | string | null | undefined): string =>
  String(id ?? 0).padStart(5, "0");
