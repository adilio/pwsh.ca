import { resolveActor } from "../lib/auth";
import { generateCode } from "../lib/generator";
import { err, methodNotAllowed, ok } from "../lib/http";
import {
  authorizeUrl,
  exchangeCode,
  fetchProfile,
  oauthConfigured,
} from "../lib/oauth";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  STATE_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  clearCookie,
  isSecureRequest,
  readCookie,
  serializeCookie,
  sessionConfigured,
  signSession,
} from "../lib/session";
import { getUser, publicUser, setUser, upsertFromGitHub } from "../lib/users";

/**
 * GET  /api/auth/github    , begin GitHub sign-in
 * GET  /api/auth/callback  , finish sign-in and set the session cookie
 * GET  /api/auth/me        , the current identity and its access status
 * POST /api/auth/logout    , clear the session
 * POST /api/access/request , attach a reason to a pending access request
 */
export default async function handler(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);
  const action = pathname.replace(/\/+$/, "").split("/").pop() ?? "";

  switch (action) {
    case "github":
      return start(req);
    case "callback":
      return callback(req);
    case "me":
      return me(req);
    case "logout":
      return logout(req);
    case "request":
      return requestAccess(req);
    default:
      return err(404, "not_found", `No auth route "${action}".`);
  }
}

function start(req: Request): Response {
  if (req.method !== "GET") return methodNotAllowed(["GET"]);
  if (!oauthConfigured() || !sessionConfigured()) {
    return err(
      500,
      "not_configured",
      "GitHub sign-in is not configured on this deploy.",
    );
  }

  // The nonce is echoed back by GitHub and compared against this cookie,
  // which is what stops a forged callback from logging someone in.
  const state = generateCode(32);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl(req, state),
      "Set-Cookie": serializeCookie(STATE_COOKIE, state, {
        maxAge: STATE_TTL_SECONDS,
        secure: isSecureRequest(req),
      }),
      "Cache-Control": "no-store",
    },
  });
}

/** Send the browser back to /admin with a message the SPA can render. */
function backToAdmin(req: Request, cookies: string[], problem?: string): Response {
  const target = new URL("/admin", req.url);
  if (problem) target.searchParams.set("error", problem);

  const headers = new Headers({
    Location: target.toString(),
    "Cache-Control": "no-store",
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

async function callback(req: Request): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(["GET"]);
  if (!oauthConfigured() || !sessionConfigured()) {
    return err(500, "not_configured", "GitHub sign-in is not configured.");
  }

  const secure = isSecureRequest(req);
  const dropState = clearCookie(STATE_COOKIE, secure);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = readCookie(req, STATE_COOKIE);

  if (url.searchParams.get("error")) {
    return backToAdmin(req, [dropState], "github_declined");
  }
  if (!code || !state || !expected || state !== expected) {
    return backToAdmin(req, [dropState], "bad_state");
  }

  const token = await exchangeCode(req, code);
  if (!token) return backToAdmin(req, [dropState], "exchange_failed");

  const profile = await fetchProfile(token);
  if (!profile) return backToAdmin(req, [dropState], "profile_failed");

  const user = await upsertFromGitHub(profile);
  const session = serializeCookie(SESSION_COOKIE, signSession(user.id), {
    maxAge: SESSION_TTL_SECONDS,
    secure,
  });
  return backToAdmin(req, [dropState, session]);
}

async function me(req: Request): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(["GET"]);

  const actor = await resolveActor(req);
  if (!actor) return ok({ signedIn: false });

  // The break-glass ADMIN_TOKEN has no user record; describe it as an owner.
  if (!actor.user) {
    return ok({
      signedIn: true,
      user: {
        id: actor.id,
        githubLogin: actor.githubLogin,
        name: "Admin token",
        email: null,
        avatarUrl: null,
        status: "approved",
        role: "owner",
        requestedAt: new Date(0).toISOString(),
      },
    });
  }
  return ok({ signedIn: true, user: publicUser(actor.user) });
}

async function logout(req: Request): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(["POST"]);
  return new Response(
    JSON.stringify({ success: true, data: { signedOut: true } }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearCookie(SESSION_COOKIE, isSecureRequest(req)),
      },
    },
  );
}

/** A pending user explaining why they want access. */
async function requestAccess(req: Request): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(["POST"]);

  const actor = await resolveActor(req);
  if (!actor || !actor.user) {
    return err(401, "unauthorized", "Sign in with GitHub first.");
  }

  let body: { reason?: unknown };
  try {
    body = (await req.json()) as { reason?: unknown };
  } catch {
    return err(400, "invalid_json", "Request body must be JSON.");
  }
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  // Re-read rather than trusting the actor snapshot: a decision may have
  // landed between sign-in and this call.
  const user = await getUser(actor.user.id);
  if (!user) return err(404, "not_found", "No such user.");
  if (user.status !== "pending") {
    return ok(publicUser(user));
  }

  const updated = { ...user, ...(reason ? { reason } : {}) };
  await setUser(updated);
  return ok(publicUser(updated));
}
