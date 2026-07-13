import { resolveStorageUrl } from "../lib/api";

/** Turn a backend-relative storage path (e.g. "/storage/documents/x.pdf") into an absolute URL. */
export const resolveFileUrl = (url: string | undefined | null): string =>
  resolveStorageUrl(url) || "";
