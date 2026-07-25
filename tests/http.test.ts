import { describe, expect, it } from "vitest";
import { codeFromPath, err, ok } from "../netlify/lib/http";

describe("codeFromPath", () => {
  it("extracts the trailing code", () => {
    expect(codeFromPath("/api/links/abc", "links")).toBe("abc");
    expect(codeFromPath("/api/info/xY-9_", "info")).toBe("xY-9_");
    expect(codeFromPath("/.netlify/functions/links/abc", "links")).toBe("abc");
  });

  it("returns null when no code is present", () => {
    expect(codeFromPath("/api/links", "links")).toBeNull();
    expect(codeFromPath("/api/links/", "links")).toBeNull();
    expect(codeFromPath("/.netlify/functions/links", "links")).toBeNull();
  });

  it("rejects nested paths and decodes escapes", () => {
    expect(codeFromPath("/api/links/a/b", "links")).toBeNull();
    expect(codeFromPath("/api/links/a%20b", "links")).toBe("a b");
  });

  it("returns null on malformed percent-encoding instead of throwing", () => {
    expect(codeFromPath("/api/links/%", "links")).toBeNull();
    expect(codeFromPath("/api/links/%zz", "links")).toBeNull();
  });
});

describe("response envelope", () => {
  it("wraps success payloads", async () => {
    const res = ok({ hello: "world" }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      data: { hello: "world" },
    });
  });

  it("wraps errors with code and message", async () => {
    const res = err(404, "not_found", "nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "not_found", message: "nope" },
    });
  });
});
