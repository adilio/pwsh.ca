import { timingSafeEqual } from "node:crypto";
import { err } from "./http";
import { looksLikeApiKey, lookupKey, touchKey } from "./keys";
import { SESSION_COOKIE, readCookie, verifySession } from "./session";
import type { LinkRecord } from "./store";
import { getUser, type UserRecord, type UserRole } from "./users";

/** Who is making this request, and how they proved it. */
export interface Actor {
  id: string;
  githubLogin: string;
  role: UserRole;
  via: "admin_token" | "api_key" | "session";
  /** Null for the ADMIN_TOKEN break-glass actor, which has no user record. */
  user: UserRecord | null;
}

/** The synthetic actor behind the ADMIN_TOKEN break-glass credential. */
const ADMIN_TOKEN_ACTOR: Omit<Actor, "via"> = {
  id: "admin-token",
  githubLogin: "admin-token",
  role: "owner",
  user: null,
};

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

/**
 * Work out who is calling, without judging whether they are allowed in.
 * Returns null when no credential was presented or the credential is bad.
 *
 * Order matters: the shared ADMIN_TOKEN wins so that existing scripts keep
 * working, then a personal API key, then a browser session cookie.
 */
export async function resolveActor(req: Request): Promise<Actor | null> {
  const token = bearerToken(req);

  if (token) {
    const adminToken = process.env.ADMIN_TOKEN;
    if (adminToken && safeEqual(token, adminToken)) {
      return { ...ADMIN_TOKEN_ACTOR, via: "admin_token" };
    }
    if (looksLikeApiKey(token)) {
      const key = await lookupKey(token);
      if (!key) return null;
      const user = await getUser(key.userId);
      if (!user) return null;
      void touchKey(key);
      return actorFor(user, "api_key");
    }
    return null;
  }

  const cookie = readCookie(req, SESSION_COOKIE);
  if (!cookie) return null;
  const userId = verifySession(cookie);
  if (!userId) return null;
  const user = await getUser(userId);
  return user ? actorFor(user, "session") : null;
}

function actorFor(user: UserRecord, via: Actor["via"]): Actor {
  return {
    id: user.id,
    githubLogin: user.githubLogin,
    role: user.role,
    via,
    user,
  };
}

/**
 * Gate for every management endpoint: resolve the caller and insist they are
 * approved. Returns the actor, or the error response to send back.
 *
 * Status is read from the user record on every call rather than from the
 * session token, so an approval that gets withdrawn takes effect at once.
 */
export async function requireApproved(req: Request): Promise<Actor | Response> {
  const actor = await resolveActor(req);
  if (!actor) {
    return err(401, "unauthorized", "Sign in at /admin or present an API key.");
  }
  if (actor.user && actor.user.status !== "approved") {
    return actor.user.status === "pending"
      ? err(
          403,
          "pending_approval",
          "Your access request is waiting to be reviewed.",
        )
      : err(403, "access_denied", "Your access request was not approved.");
  }
  return actor;
}

/** Narrow an approved actor to the site owner. */
export async function requireOwner(req: Request): Promise<Actor | Response> {
  const actor = await requireApproved(req);
  if (actor instanceof Response) return actor;
  if (actor.role !== "owner") {
    return err(403, "owner_only", "Only the site owner can do that.");
  }
  return actor;
}

export function isResponse(value: Actor | Response): value is Response {
  return value instanceof Response;
}

/**
 * Any approved member may create links and read them all. Changing one —
 * repointing or deleting — needs either a link-management role or authorship.
 *
 * Records created before attribution existed have no `createdBy`, so no member
 * can claim them; they are left to owners and admins.
 */
export function canModify(actor: Actor, record: LinkRecord): boolean {
  if (actor.role === "owner" || actor.role === "admin") return true;
  return Boolean(record.createdBy) && record.createdBy === actor.id;
}
