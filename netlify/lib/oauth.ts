import type { GitHubProfile } from "./users";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const EMAILS_URL = "https://api.github.com/user/emails";

/** We need the profile and the verified email addresses, nothing more. */
const SCOPE = "read:user user:email";

export function oauthConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

/** The callback GitHub redirects back to, derived from the incoming request. */
export function callbackUrl(req: Request): string {
  return new URL("/api/auth/callback", req.url).toString();
}

export function authorizeUrl(req: Request, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", callbackUrl(req));
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Exchange the callback's `code` for a user access token. */
export async function exchangeCode(
  req: Request,
  code: string,
): Promise<string | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(req),
    }),
  });
  if (!res.ok) return null;

  const body = (await res.json()) as { access_token?: unknown };
  return typeof body.access_token === "string" && body.access_token
    ? body.access_token
    : null;
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "pwsh.ca",
  };
}

/**
 * Fetch the signed-in user's profile. The email comes from /user/emails so we
 * only ever accept an address GitHub has *verified* — the public profile email
 * is user-set and not proof of anything.
 */
export async function fetchProfile(token: string): Promise<GitHubProfile | null> {
  const res = await fetch(USER_URL, { headers: ghHeaders(token) });
  if (!res.ok) return null;

  const user = (await res.json()) as {
    id?: unknown;
    login?: unknown;
    name?: unknown;
    avatar_url?: unknown;
  };
  if (typeof user.id !== "number" || typeof user.login !== "string") return null;

  return {
    id: user.id,
    login: user.login,
    email: await fetchVerifiedEmail(token),
    name: typeof user.name === "string" ? user.name : null,
    avatarUrl: typeof user.avatar_url === "string" ? user.avatar_url : null,
  };
}

async function fetchVerifiedEmail(token: string): Promise<string | null> {
  const res = await fetch(EMAILS_URL, { headers: ghHeaders(token) });
  if (!res.ok) return null;

  const emails = (await res.json()) as Array<{
    email?: unknown;
    primary?: unknown;
    verified?: unknown;
  }>;
  if (!Array.isArray(emails)) return null;

  const verified = emails.filter(
    (e) => e.verified === true && typeof e.email === "string",
  );
  const chosen = verified.find((e) => e.primary === true) ?? verified[0];
  return chosen ? (chosen.email as string) : null;
}
