import { timingSafeEqual } from "node:crypto";
import { err } from "./http";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Admin-token gate. Returns null when authorized, otherwise the error
 * response to send back.
 */
export function requireAdmin(req: Request): Response | null {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return err(500, "not_configured", "ADMIN_TOKEN is not configured.");
  }
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || !safeEqual(match[1], token)) {
    return err(401, "unauthorized", "A valid admin bearer token is required.");
  }
  return null;
}
