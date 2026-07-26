import { getStore } from "@netlify/blobs";

export type UserStatus = "pending" | "approved" | "denied";

/**
 * - `owner`  , the super admin: everything an admin can do, plus deciding who
 *              gets in and what role they hold. Exactly one, set by
 *              OWNER_GITHUB_LOGIN rather than by anything in the store.
 * - `admin`  , full control over every link, no say over people.
 * - `member` , creates links and manages the ones they created.
 */
export type UserRole = "owner" | "admin" | "member";

/** Roles the owner may hand out. `owner` is deliberately not assignable. */
export const ASSIGNABLE_ROLES = ["admin", "member"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export interface UserRecord {
  /** Stable id, e.g. "github:12345" — the numeric id, so a rename can't orphan it. */
  id: string;
  githubLogin: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  role: UserRole;
  /** Optional note the requester left when asking for access. */
  reason?: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

/** Profile fields we take from GitHub at sign-in. */
export interface GitHubProfile {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export function usersStore() {
  return getStore({ name: "users", consistency: "strong" });
}

export function userIdForGitHub(githubId: number): string {
  return `github:${githubId}`;
}

export async function getUser(id: string): Promise<UserRecord | null> {
  return (await usersStore().get(id, { type: "json" })) as UserRecord | null;
}

export async function setUser(record: UserRecord): Promise<void> {
  await usersStore().setJSON(record.id, record);
}

export async function deleteUser(id: string): Promise<void> {
  await usersStore().delete(id);
}

/** Every user, pending first, then newest request first within each group. */
export async function listUsers(): Promise<UserRecord[]> {
  const store = usersStore();
  const { blobs } = await store.list();
  const users = await Promise.all(
    blobs.map(
      async ({ key }) =>
        (await store.get(key, { type: "json" })) as UserRecord | null,
    ),
  );
  const rank: Record<UserStatus, number> = { pending: 0, approved: 1, denied: 2 };
  return users
    .filter((u): u is UserRecord => u !== null)
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        b.requestedAt.localeCompare(a.requestedAt),
    );
}

/** True when this GitHub login is the configured site owner. */
export function isOwnerLogin(login: string): boolean {
  const owner = process.env.OWNER_GITHUB_LOGIN;
  return Boolean(owner) && owner!.toLowerCase() === login.toLowerCase();
}

/**
 * Create or refresh a user from a GitHub sign-in. New accounts start `pending`
 * unless the login matches OWNER_GITHUB_LOGIN, which is how the first owner
 * account comes into existence without hand-editing a blob.
 *
 * An existing user's status and role are never changed here — only the profile
 * fields GitHub owns are refreshed.
 */
export async function upsertFromGitHub(
  profile: GitHubProfile,
): Promise<UserRecord> {
  const id = userIdForGitHub(profile.id);
  const existing = await getUser(id);
  const owner = isOwnerLogin(profile.login);

  const record: UserRecord = existing
    ? {
        ...existing,
        githubLogin: profile.login,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        // The configured owner is always restored to owner access, so losing
        // the blob store or being denied by accident can't lock you out.
        ...(owner ? { status: "approved" as const, role: "owner" as const } : {}),
      }
    : {
        id,
        githubLogin: profile.login,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        status: owner ? "approved" : "pending",
        role: owner ? "owner" : "member",
        requestedAt: new Date().toISOString(),
        ...(owner ? { decidedAt: new Date().toISOString() } : {}),
      };

  await setUser(record);
  return record;
}

/** The shape sent to the browser: no more than the UI needs. */
export function publicUser(user: UserRecord) {
  return {
    id: user.id,
    githubLogin: user.githubLogin,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    status: user.status,
    role: user.role,
    reason: user.reason,
    requestedAt: user.requestedAt,
    decidedAt: user.decidedAt,
  };
}
