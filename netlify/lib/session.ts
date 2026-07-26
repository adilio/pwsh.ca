import { createHmac, timingSafeEqual } from "node:crypto";

/** Session cookie holding the signed identity token. */
export const SESSION_COOKIE = "pwsh_session";
/** Short-lived cookie holding the OAuth `state` nonce. */
export const STATE_COOKIE = "pwsh_oauth_state";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // one week
export const STATE_TTL_SECONDS = 10 * 60;

/**
 * The token deliberately carries only the user id. Status and role are read
 * from the user record on every request, so revoking someone takes effect
 * immediately rather than whenever their token happens to expire.
 */
interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  return secret;
}

/** True when the session machinery has the config it needs. */
export function sessionConfigured(): boolean {
  return Boolean(process.env.SESSION_SECRET);
}

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", requireSecret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Mint a signed session token for a user id. `nowSeconds` is injectable for tests. */
export function signSession(
  userId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: SessionPayload = {
    sub: userId,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };
  const body = `${header}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${sign(body)}`;
}

/** Verify a session token and return its user id, or null if it is not usable. */
export function verifySession(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    if (!safeEqual(signature, sign(`${header}.${payload}`))) return null;

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (typeof decoded.sub !== "string" || !decoded.sub) return null;
    if (typeof decoded.exp !== "number" || decoded.exp <= nowSeconds) return null;
    return decoded.sub;
  } catch {
    // Malformed base64, bad JSON, or an unconfigured secret: not a valid session.
    return null;
  }
}

/** Parse a `Cookie` request header into a name → value map. */
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // Malformed percent-encoding: skip this cookie rather than failing the request.
    }
  }
  return out;
}

/** Read one cookie off a request. */
export function readCookie(req: Request, name: string): string | null {
  return parseCookies(req.headers.get("cookie"))[name] ?? null;
}

/**
 * Build a `Set-Cookie` value. `Secure` is omitted on plain http so that
 * `netlify dev` on localhost can still establish a session.
 */
export function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge: number; secure: boolean },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts.maxAge}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/** True when the request reached us over https, so cookies may be Secure. */
export function isSecureRequest(req: Request): boolean {
  if (req.headers.get("x-forwarded-proto") === "https") return true;
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** A `Set-Cookie` value that clears a cookie. */
export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, "", { maxAge: 0, secure });
}
