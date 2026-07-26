import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  clearCookie,
  isSecureRequest,
  parseCookies,
  serializeCookie,
  sessionConfigured,
  signSession,
  verifySession,
} from "../netlify/lib/session";

const NOW = 1_700_000_000;

describe("session tokens", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });
  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it("round-trips a user id", () => {
    const token = signSession("github:1", NOW);
    expect(verifySession(token, NOW + 60)).toBe("github:1");
  });

  it("rejects a tampered payload", () => {
    const [header, , signature] = signSession("github:1", NOW).split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "github:999", iat: NOW, exp: NOW + 3600 }),
    ).toString("base64url");
    expect(verifySession(`${header}.${forged}.${signature}`, NOW)).toBeNull();
  });

  it("rejects a bad signature, malformed input, and the empty string", () => {
    const token = signSession("github:1", NOW);
    expect(verifySession(`${token}x`, NOW)).toBeNull();
    expect(verifySession("not.a.jwt", NOW)).toBeNull();
    expect(verifySession("", NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signSession("github:1", NOW);
    expect(verifySession(token, NOW + SESSION_TTL_SECONDS + 1)).toBeNull();
  });

  it("does not verify under a different secret", () => {
    const token = signSession("github:1", NOW);
    process.env.SESSION_SECRET = "another-secret";
    expect(verifySession(token, NOW)).toBeNull();
  });

  it("reports whether it is configured", () => {
    expect(sessionConfigured()).toBe(true);
    delete process.env.SESSION_SECRET;
    expect(sessionConfigured()).toBe(false);
    // An unconfigured secret must fail closed, not throw.
    expect(verifySession("a.b.c", NOW)).toBeNull();
  });
});

describe("cookies", () => {
  it("parses a cookie header, skipping malformed pairs", () => {
    expect(parseCookies("a=1; b=two; junk; c=%2Fpath")).toEqual({
      a: "1",
      b: "two",
      c: "/path",
    });
    expect(parseCookies(null)).toEqual({});
  });

  it("survives malformed percent-encoding", () => {
    expect(parseCookies("bad=%; good=1")).toEqual({ good: "1" });
  });

  it("marks cookies HttpOnly and Lax, and Secure only when asked", () => {
    const secure = serializeCookie("s", "v", { maxAge: 60, secure: true });
    expect(secure).toContain("HttpOnly");
    expect(secure).toContain("SameSite=Lax");
    expect(secure).toContain("Secure");

    // Plain http (netlify dev on localhost) must still be able to set a session.
    expect(serializeCookie("s", "v", { maxAge: 60, secure: false })).not.toContain(
      "Secure",
    );
  });

  it("clears a cookie with a zero max-age", () => {
    expect(clearCookie("s", false)).toContain("Max-Age=0");
  });

  it("detects https from the url and the forwarded-proto header", () => {
    expect(isSecureRequest(new Request("https://pwsh.ca/x"))).toBe(true);
    expect(isSecureRequest(new Request("http://localhost:8888/x"))).toBe(false);
    expect(
      isSecureRequest(
        new Request("http://localhost:8888/x", {
          headers: { "x-forwarded-proto": "https" },
        }),
      ),
    ).toBe(true);
  });
});
