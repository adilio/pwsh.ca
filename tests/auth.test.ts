import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The users and keys stores are Netlify Blobs backed; stand them in with maps
// so the resolution *logic* can be tested without a running blob service.
const users = new Map<string, UserRecord>();
const keys = new Map<string, { hash: string; userId: string }>();

vi.mock("../netlify/lib/users", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../netlify/lib/users")>();
  return {
    ...actual,
    getUser: async (id: string) => users.get(id) ?? null,
  };
});

vi.mock("../netlify/lib/keys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../netlify/lib/keys")>();
  return {
    ...actual,
    lookupKey: async (plaintext: string) =>
      keys.get(actual.hashKey(plaintext)) ?? null,
    touchKey: async () => {},
  };
});

const { canModify, requireApproved, requireOwner, resolveActor } = await import(
  "../netlify/lib/auth"
);
const { signSession } = await import("../netlify/lib/session");
type UserRecord = import("../netlify/lib/users").UserRecord;
type Actor = import("../netlify/lib/auth").Actor;

function user(over: Partial<UserRecord> & Pick<UserRecord, "id">): UserRecord {
  return {
    githubLogin: "someone",
    email: null,
    name: null,
    avatarUrl: null,
    status: "approved",
    role: "member",
    requestedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://pwsh.ca/api/links", { headers });
}

beforeEach(() => {
  users.clear();
  keys.clear();
  process.env.SESSION_SECRET = "test-secret";
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  delete process.env.ADMIN_TOKEN;
});

describe("resolveActor", () => {
  it("returns null with no credential at all", async () => {
    expect(await resolveActor(req())).toBeNull();
  });

  it("accepts the ADMIN_TOKEN as a break-glass owner", async () => {
    process.env.ADMIN_TOKEN = "s3cret";
    const actor = await resolveActor(req({ Authorization: "Bearer s3cret" }));
    expect(actor).toMatchObject({ role: "owner", via: "admin_token", user: null });
  });

  it("rejects a wrong, malformed, or length-mismatched admin token", async () => {
    process.env.ADMIN_TOKEN = "s3cret";
    expect(await resolveActor(req({ Authorization: "Bearer wrong" }))).toBeNull();
    expect(await resolveActor(req({ Authorization: "s3cret" }))).toBeNull();
    expect(
      await resolveActor(req({ Authorization: "Bearer s3cret-longer" })),
    ).toBeNull();
  });

  it("resolves a personal API key to its user", async () => {
    const { hashKey } = await import("../netlify/lib/keys");
    users.set("github:1", user({ id: "github:1", githubLogin: "ada" }));
    keys.set(hashKey("pwsh_live"), {
      hash: hashKey("pwsh_live"),
      userId: "github:1",
    });

    const actor = await resolveActor(req({ Authorization: "Bearer pwsh_live" }));
    expect(actor).toMatchObject({ id: "github:1", githubLogin: "ada", via: "api_key" });
  });

  it("rejects an unknown key and a key whose user is gone", async () => {
    const { hashKey } = await import("../netlify/lib/keys");
    expect(
      await resolveActor(req({ Authorization: "Bearer pwsh_nope" })),
    ).toBeNull();

    keys.set(hashKey("pwsh_orphan"), {
      hash: hashKey("pwsh_orphan"),
      userId: "github:missing",
    });
    expect(
      await resolveActor(req({ Authorization: "Bearer pwsh_orphan" })),
    ).toBeNull();
  });

  it("prefers the admin token over an API key with the same value", async () => {
    const { hashKey } = await import("../netlify/lib/keys");
    process.env.ADMIN_TOKEN = "pwsh_shared";
    users.set("github:1", user({ id: "github:1" }));
    keys.set(hashKey("pwsh_shared"), {
      hash: hashKey("pwsh_shared"),
      userId: "github:1",
    });

    const actor = await resolveActor(req({ Authorization: "Bearer pwsh_shared" }));
    expect(actor?.via).toBe("admin_token");
  });

  it("resolves a session cookie", async () => {
    users.set("github:7", user({ id: "github:7", githubLogin: "grace" }));
    const actor = await resolveActor(
      req({ Cookie: `pwsh_session=${signSession("github:7")}` }),
    );
    expect(actor).toMatchObject({ id: "github:7", via: "session" });
  });

  it("ignores a forged or expired session cookie", async () => {
    users.set("github:7", user({ id: "github:7" }));
    expect(await resolveActor(req({ Cookie: "pwsh_session=forged" }))).toBeNull();
  });

  it("ignores a valid cookie whose user no longer exists", async () => {
    const cookie = `pwsh_session=${signSession("github:deleted")}`;
    expect(await resolveActor(req({ Cookie: cookie }))).toBeNull();
  });
});

describe("requireApproved", () => {
  it("401s with no credential", async () => {
    const res = await requireApproved(req());
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });

  it("403s a pending user with a distinguishable code", async () => {
    users.set("github:2", user({ id: "github:2", status: "pending" }));
    const res = (await requireApproved(
      req({ Cookie: `pwsh_session=${signSession("github:2")}` }),
    )) as Response;
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "pending_approval" },
    });
  });

  it("403s a denied user", async () => {
    users.set("github:3", user({ id: "github:3", status: "denied" }));
    const res = (await requireApproved(
      req({ Cookie: `pwsh_session=${signSession("github:3")}` }),
    )) as Response;
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "access_denied" },
    });
  });

  it("lets an approved member through", async () => {
    users.set("github:4", user({ id: "github:4" }));
    const actor = await requireApproved(
      req({ Cookie: `pwsh_session=${signSession("github:4")}` }),
    );
    expect(actor).not.toBeInstanceOf(Response);
  });
});

describe("requireOwner", () => {
  it("turns an approved member away", async () => {
    users.set("github:5", user({ id: "github:5", role: "member" }));
    const res = (await requireOwner(
      req({ Cookie: `pwsh_session=${signSession("github:5")}` }),
    )) as Response;
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "owner_only" },
    });
  });

  it("turns an admin away — people management is the owner's alone", async () => {
    users.set("github:8", user({ id: "github:8", role: "admin" }));
    const res = (await requireOwner(
      req({ Cookie: `pwsh_session=${signSession("github:8")}` }),
    )) as Response;
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "owner_only" },
    });
  });

  it("lets the owner through", async () => {
    users.set("github:6", user({ id: "github:6", role: "owner" }));
    const actor = await requireOwner(
      req({ Cookie: `pwsh_session=${signSession("github:6")}` }),
    );
    expect(actor).not.toBeInstanceOf(Response);
  });
});

describe("canModify", () => {
  const member = (
    id: string,
    role: "owner" | "admin" | "member" = "member",
  ): Actor => ({
    id,
    githubLogin: id,
    role,
    via: "session",
    user: user({ id, role }),
  });
  const link = (createdBy?: string) => ({
    url: "https://example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...(createdBy ? { createdBy } : {}),
  });

  it("lets a member change their own link", () => {
    expect(canModify(member("github:1"), link("github:1"))).toBe(true);
  });

  it("stops a member changing someone else's link", () => {
    expect(canModify(member("github:1"), link("github:2"))).toBe(false);
  });

  it("lets the owner change anything", () => {
    expect(canModify(member("github:9", "owner"), link("github:1"))).toBe(true);
  });

  it("lets an admin change anyone's link", () => {
    expect(canModify(member("github:8", "admin"), link("github:1"))).toBe(true);
    expect(canModify(member("github:8", "admin"), link("github:9"))).toBe(true);
    expect(canModify(member("github:8", "admin"), link("github:8"))).toBe(true);
  });

  it("leaves unattributed legacy links to owners and admins", () => {
    expect(canModify(member("github:1"), link())).toBe(false);
    expect(canModify(member("github:8", "admin"), link())).toBe(true);
    expect(canModify(member("github:9", "owner"), link())).toBe(true);
  });
});
