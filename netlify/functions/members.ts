import { isResponse, requireOwner } from "../lib/auth";
import { codeFromPath, err, methodNotAllowed, ok } from "../lib/http";
import { revokeAllFor } from "../lib/keys";
import {
  ASSIGNABLE_ROLES,
  deleteUser,
  getUser,
  listUsers,
  publicUser,
  setUser,
  type AssignableRole,
  type UserStatus,
} from "../lib/users";

/**
 * GET    /api/members      , everyone who has signed in, pending first
 * PATCH  /api/members/:id  , approve or deny a request, and/or set a role
 * DELETE /api/members/:id  , withdraw access and revoke that member's keys
 *
 * Owner only, throughout. Deciding who gets in, and what they can do once
 * they are in, is the one thing an admin cannot do.
 */
export default async function handler(req: Request): Promise<Response> {
  const actor = await requireOwner(req);
  if (isResponse(actor)) return actor;

  const id = codeFromPath(new URL(req.url).pathname, "members");

  switch (req.method) {
    case "GET": {
      if (id) {
        const user = await getUser(id);
        if (!user) return err(404, "not_found", `No member "${id}".`);
        return ok(publicUser(user));
      }
      return ok((await listUsers()).map(publicUser));
    }

    case "PATCH": {
      if (!id) return err(400, "missing_id", "PATCH /api/members/:id");
      const user = await getUser(id);
      if (!user) return err(404, "not_found", `No member "${id}".`);
      if (user.role === "owner") {
        return err(400, "owner_immutable", "The owner's access cannot be changed.");
      }

      let body: { status?: unknown; role?: unknown };
      try {
        body = (await req.json()) as { status?: unknown; role?: unknown };
      } catch {
        return err(400, "invalid_json", "Request body must be JSON.");
      }

      const { status, role } = body;
      if (status === undefined && role === undefined) {
        return err(400, "nothing_to_do", "Provide a status, a role, or both.");
      }
      if (status !== undefined && status !== "approved" && status !== "denied") {
        return err(400, "invalid_status", 'Use {"status":"approved"|"denied"}.');
      }
      // `owner` comes from OWNER_GITHUB_LOGIN alone — it is never handed out
      // over the API, so there is no way to promote a second super admin.
      if (
        role !== undefined &&
        !ASSIGNABLE_ROLES.includes(role as AssignableRole)
      ) {
        return err(400, "invalid_role", 'Use {"role":"admin"|"member"}.');
      }

      // Denying someone mid-session must also kill their scripts.
      if (status === "denied") await revokeAllFor(user.id);

      const updated = {
        ...user,
        ...(status !== undefined ? { status: status as UserStatus } : {}),
        ...(role !== undefined ? { role: role as AssignableRole } : {}),
        decidedAt: new Date().toISOString(),
        decidedBy: actor.githubLogin,
      };
      await setUser(updated);
      return ok(publicUser(updated));
    }

    case "DELETE": {
      if (!id) return err(400, "missing_id", "DELETE /api/members/:id");
      const user = await getUser(id);
      if (!user) return err(404, "not_found", `No member "${id}".`);
      if (user.role === "owner") {
        return err(400, "owner_immutable", "The owner cannot be removed.");
      }

      const revoked = await revokeAllFor(user.id);
      await deleteUser(user.id);
      return ok({ id: user.id, deleted: true, keysRevoked: revoked });
    }

    default:
      return methodNotAllowed(["GET", "PATCH", "DELETE"]);
  }
}
