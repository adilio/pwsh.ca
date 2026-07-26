import { isResponse, requireApproved } from "../lib/auth";
import { codeFromPath, err, methodNotAllowed, ok } from "../lib/http";
import { getKey, listKeysFor, mintKey, publicKey, revokeKey } from "../lib/keys";

const MAX_KEYS_PER_USER = 10;

/**
 * GET    /api/keys       , my keys (metadata only)
 * POST   /api/keys       , mint a key; the plaintext appears in this response only
 * DELETE /api/keys/:hash , revoke a key
 */
export default async function handler(req: Request): Promise<Response> {
  const actor = await requireApproved(req);
  if (isResponse(actor)) return actor;

  // The break-glass ADMIN_TOKEN is not a user, so it has nothing to hang keys on.
  if (!actor.user) {
    return err(
      400,
      "no_identity",
      "API keys belong to a signed-in user. Sign in with GitHub at /admin.",
    );
  }
  const userId = actor.user.id;

  switch (req.method) {
    case "GET":
      return ok((await listKeysFor(userId)).map(publicKey));

    case "POST": {
      let body: { label?: unknown } = {};
      try {
        body = (await req.json()) as { label?: unknown };
      } catch {
        // A label is optional, so an empty or absent body is fine.
      }
      const label =
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim().slice(0, 60)
          : "Untitled key";

      const existing = await listKeysFor(userId);
      if (existing.length >= MAX_KEYS_PER_USER) {
        return err(
          409,
          "key_limit",
          `You already have ${MAX_KEYS_PER_USER} keys. Revoke one first.`,
        );
      }

      const { plaintext, record } = await mintKey(userId, label);
      // `key` is returned exactly once and never stored in plaintext anywhere.
      return ok({ ...publicKey(record), key: plaintext }, 201);
    }

    case "DELETE": {
      const hash = codeFromPath(new URL(req.url).pathname, "keys");
      if (!hash) return err(400, "missing_hash", "DELETE /api/keys/:hash");

      const record = await getKey(hash);
      if (!record) return err(404, "not_found", "No such key.");
      if (record.userId !== userId && actor.role !== "owner") {
        return err(403, "not_yours", "That key belongs to someone else.");
      }

      await revokeKey(hash);
      return ok({ hash, revoked: true });
    }

    default:
      return methodNotAllowed(["GET", "POST", "DELETE"]);
  }
}
