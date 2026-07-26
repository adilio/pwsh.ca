import { canModify, isResponse, requireApproved } from "../lib/auth";
import { codeFromPath, err, methodNotAllowed, ok } from "../lib/http";
import { deleteLink, getLink, listLinks, setLink } from "../lib/store";
import { isValidTargetUrl } from "../lib/validator";

/**
 * GET    /api/links       , list all links
 * PATCH  /api/links/:code , change a link's target URL (creator or owner only)
 * DELETE /api/links/:code , remove a link (creator or owner only)
 *
 * Every approved member sees every link; only its creator and the owner can
 * change one.
 */
const NOT_YOURS =
  "Only the member who created this link, or the site owner, can change it.";
export default async function handler(req: Request): Promise<Response> {
  const actor = await requireApproved(req);
  if (isResponse(actor)) return actor;

  const code = codeFromPath(new URL(req.url).pathname, "links");

  switch (req.method) {
    case "GET": {
      if (code) {
        const record = await getLink(code);
        if (!record) return err(404, "not_found", `No link "${code}".`);
        return ok({ code, ...record });
      }
      return ok(await listLinks());
    }

    case "PATCH": {
      if (!code) return err(400, "missing_code", "PATCH /api/links/:code");
      const record = await getLink(code);
      if (!record) return err(404, "not_found", `No link "${code}".`);
      if (!canModify(actor, record)) return err(403, "not_owner", NOT_YOURS);

      let body: { url?: unknown };
      try {
        body = (await req.json()) as { url?: unknown };
      } catch {
        return err(400, "invalid_json", "Request body must be JSON.");
      }
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!isValidTargetUrl(url)) {
        return err(400, "invalid_url", "Provide an absolute http(s) URL.");
      }

      const updated = { ...record, url };
      await setLink(code, updated);
      return ok({ code, ...updated });
    }

    case "DELETE": {
      if (!code) return err(400, "missing_code", "DELETE /api/links/:code");
      const record = await getLink(code);
      if (!record) return err(404, "not_found", `No link "${code}".`);
      if (!canModify(actor, record)) return err(403, "not_owner", NOT_YOURS);
      await deleteLink(code);
      return ok({ code, deleted: true });
    }

    default:
      return methodNotAllowed(["GET", "PATCH", "DELETE"]);
  }
}
