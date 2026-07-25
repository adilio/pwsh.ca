import { codeFromPath, err, methodNotAllowed, ok } from "../lib/http";
import { getLink } from "../lib/store";

/** GET /api/info/:code, public lookup of a link's target + metadata. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed(["GET"]);

  const code = codeFromPath(new URL(req.url).pathname, "info");
  if (!code) return err(400, "missing_code", "GET /api/info/:code");

  const record = await getLink(code);
  if (!record) return err(404, "not_found", `No link "${code}".`);
  return ok({ code, ...record });
}
