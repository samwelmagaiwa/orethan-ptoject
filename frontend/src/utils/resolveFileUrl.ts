import { API_BASE } from "../lib/api";

/** Turn a backend-relative storage path (e.g. "/storage/documents/x.pdf") into an absolute URL. */
export const resolveFileUrl = (url: string | undefined | null): string => {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  const baseUrl = API_BASE.replace("/api/v1", "");
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};
