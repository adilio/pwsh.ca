export interface LinkRow {
  code: string;
  url: string;
  createdAt: string;
  createdBy?: string;
  createdByLogin?: string;
}

export type UserStatus = "pending" | "approved" | "denied";

/** owner = super admin (people + links), admin = every link, member = own links. */
export type UserRole = "owner" | "admin" | "member";
export type AssignableRole = "admin" | "member";

export interface Member {
  id: string;
  githubLogin: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  role: UserRole;
  reason?: string;
  requestedAt: string;
  decidedAt?: string;
}

export interface ApiKey {
  hash: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
}

/** A freshly minted key: `key` is present here and nowhere else, ever again. */
export interface MintedKey extends ApiKey {
  key: string;
}

export type Session =
  | { signedIn: false }
  | { signedIn: true; user: Member };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Every call rides the session cookie. Personal API keys are for scripts, and
 * deliberately never touch the browser — nothing here reads localStorage.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  let envelope: {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  };
  try {
    envelope = await res.json();
  } catch {
    throw new ApiError(
      `Unexpected response (${res.status})`,
      "bad_response",
      res.status,
    );
  }

  if (!res.ok || !envelope.success) {
    throw new ApiError(
      envelope.error?.message ?? `Request failed (${res.status})`,
      envelope.error?.code ?? "request_failed",
      res.status,
    );
  }
  return envelope.data as T;
}

export const api = {
  // --- identity -------------------------------------------------------------
  me: () => request<Session>("/api/auth/me"),

  logout: () => request<{ signedOut: boolean }>("/api/auth/logout", {
    method: "POST",
  }),

  requestAccess: (reason: string) =>
    request<Member>("/api/access/request", {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // --- links ----------------------------------------------------------------
  list: () => request<LinkRow[]>("/api/links"),

  create: (url: string, code?: string) =>
    request<LinkRow & { shortUrl: string }>("/api/shorten", {
      method: "POST",
      body: JSON.stringify(code ? { url, code } : { url }),
    }),

  update: (code: string, url: string) =>
    request<LinkRow>(`/api/links/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify({ url }),
    }),

  remove: (code: string) =>
    request<{ code: string; deleted: boolean }>(
      `/api/links/${encodeURIComponent(code)}`,
      { method: "DELETE" },
    ),

  // --- members (owner only) -------------------------------------------------
  members: () => request<Member[]>("/api/members"),

  decide: (id: string, status: "approved" | "denied") =>
    request<Member>(`/api/members/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  setRole: (id: string, role: AssignableRole) =>
    request<Member>(`/api/members/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  removeMember: (id: string) =>
    request<{ id: string; deleted: boolean; keysRevoked: number }>(
      `/api/members/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),

  // --- API keys -------------------------------------------------------------
  keys: () => request<ApiKey[]>("/api/keys"),

  mintKey: (label: string) =>
    request<MintedKey>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ label }),
    }),

  revokeKey: (hash: string) =>
    request<{ hash: string; revoked: boolean }>(
      `/api/keys/${encodeURIComponent(hash)}`,
      { method: "DELETE" },
    ),
};

/** Mirrors the server's rule so the UI can hide actions it would reject. */
export function canModify(user: Member, link: LinkRow): boolean {
  if (user.role === "owner" || user.role === "admin") return true;
  return Boolean(link.createdBy) && link.createdBy === user.id;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Super admin",
  admin: "Admin",
  member: "Member",
};
