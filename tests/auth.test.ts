import { afterEach, describe, expect, it } from "vitest";
import { requireAdmin } from "../netlify/lib/auth";

function reqWith(header?: string): Request {
  return new Request("https://pwsh.ca/api/links", {
    headers: header ? { Authorization: header } : {},
  });
}

describe("requireAdmin", () => {
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it("fails closed when ADMIN_TOKEN is not configured", () => {
    const res = requireAdmin(reqWith("Bearer anything"));
    expect(res?.status).toBe(500);
  });

  it("rejects missing, malformed, and wrong tokens", () => {
    process.env.ADMIN_TOKEN = "s3cret";
    expect(requireAdmin(reqWith())?.status).toBe(401);
    expect(requireAdmin(reqWith("s3cret"))?.status).toBe(401);
    expect(requireAdmin(reqWith("Bearer wrong"))?.status).toBe(401);
    expect(requireAdmin(reqWith("Bearer s3cret-longer"))?.status).toBe(401);
  });

  it("accepts the correct bearer token", () => {
    process.env.ADMIN_TOKEN = "s3cret";
    expect(requireAdmin(reqWith("Bearer s3cret"))).toBeNull();
    expect(requireAdmin(reqWith("bearer s3cret"))).toBeNull();
  });
});
