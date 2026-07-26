import { isResponse, requireApproved } from "../lib/auth";
import { generateCode } from "../lib/generator";
import { err, methodNotAllowed, ok } from "../lib/http";
import { getLink, setLink } from "../lib/store";
import { isValidTargetUrl, validateCode } from "../lib/validator";

const MAX_GENERATION_ATTEMPTS = 5;

/** POST /api/shorten, create a short link (random or custom code). */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(["POST"]);
  const actor = await requireApproved(req);
  if (isResponse(actor)) return actor;

  let body: { url?: unknown; code?: unknown };
  try {
    body = (await req.json()) as { url?: unknown; code?: unknown };
  } catch {
    return err(400, "invalid_json", "Request body must be JSON.");
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!isValidTargetUrl(url)) {
    return err(400, "invalid_url", "Provide an absolute http(s) URL.");
  }

  let code: string;
  if (body.code !== undefined && body.code !== null && body.code !== "") {
    if (typeof body.code !== "string") {
      return err(400, "invalid_code", "Custom code must be a string.");
    }
    const valid = validateCode(body.code);
    if (!valid.ok) return err(400, "invalid_code", valid.reason);
    if (await getLink(body.code)) {
      return err(409, "code_taken", `"${body.code}" is already in use.`);
    }
    code = body.code;
  } else {
    let generated: string | null = null;
    for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
      const candidate = generateCode();
      if (!(await getLink(candidate))) {
        generated = candidate;
        break;
      }
    }
    if (!generated) {
      return err(503, "generation_failed", "Could not find a free code; retry.");
    }
    code = generated;
  }

  const record = {
    url,
    createdAt: new Date().toISOString(),
    createdBy: actor.id,
    createdByLogin: actor.githubLogin,
  };
  await setLink(code, record);

  const origin = new URL(req.url).origin;
  return ok({ code, ...record, shortUrl: `${origin}/${code}` }, 201);
}
