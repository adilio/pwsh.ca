/**
 * Paths that short codes must never shadow: real routes, static assets,
 * and anything Netlify itself serves.
 */
export const RESERVED_CODES = new Set([
  "",
  "api",
  "apps",
  "app",
  "admin",
  "assets",
  "static",
  "fonts",
  "netlify",
  ".netlify",
  "index.html",
  "favicon.svg",
  "favicon.ico",
  "icon.svg",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "404",
  "404.html",
]);

/** Custom codes: 1-64 chars of letters, digits, dash, underscore. */
const CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type CodeValidation = { ok: true } | { ok: false; reason: string };

export function validateCode(code: string): CodeValidation {
  if (!CODE_PATTERN.test(code)) {
    return {
      ok: false,
      reason:
        "Codes must be 1-64 characters using only letters, digits, '-' and '_'.",
    };
  }
  if (RESERVED_CODES.has(code.toLowerCase())) {
    return { ok: false, reason: `"${code}" is a reserved path.` };
  }
  return { ok: true };
}

/** Accepts only absolute http/https URLs. */
export function isValidTargetUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}
