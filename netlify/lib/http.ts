/** JSON response envelope shared by every API endpoint. */

export function ok(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

export function err(status: number, code: string, message: string): Response {
  return Response.json(
    { success: false, error: { code, message } },
    { status },
  );
}

export function methodNotAllowed(allowed: string[]): Response {
  return Response.json(
    {
      success: false,
      error: { code: "method_not_allowed", message: `Use ${allowed.join(", ")}.` },
    },
    { status: 405, headers: { Allow: allowed.join(", ") } },
  );
}

/** Last path segment, e.g. /api/links/abc → "abc"; /api/links → null. */
export function codeFromPath(pathname: string, base: string): string | null {
  const path = pathname.replace(/\/+$/, "");
  const idx = path.lastIndexOf(`/${base}`);
  if (idx === -1) return null;
  const rest = path.slice(idx + base.length + 1);
  if (!rest.startsWith("/")) return null;
  let code: string;
  try {
    code = decodeURIComponent(rest.slice(1));
  } catch {
    // Malformed percent-encoding (e.g. a bare "%"), not a usable code.
    return null;
  }
  return code.length > 0 && !code.includes("/") ? code : null;
}
