import { describe, expect, it } from "vitest";
import { isValidTargetUrl, validateCode } from "../netlify/lib/validator";

describe("validateCode", () => {
  it("accepts simple alphanumeric codes", () => {
    expect(validateCode("aB3xY9").ok).toBe(true);
    expect(validateCode("my-link_2").ok).toBe(true);
    expect(validateCode("x").ok).toBe(true);
  });

  it("rejects reserved paths regardless of case", () => {
    for (const code of ["api", "APPS", "Admin", "assets", "favicon.svg"]) {
      expect(validateCode(code).ok).toBe(false);
    }
  });

  it("rejects bad characters and lengths", () => {
    expect(validateCode("").ok).toBe(false);
    expect(validateCode("has space").ok).toBe(false);
    expect(validateCode("sla/sh").ok).toBe(false);
    expect(validateCode("Ünïcode").ok).toBe(false);
    expect(validateCode("a".repeat(65)).ok).toBe(false);
    expect(validateCode("a".repeat(64)).ok).toBe(true);
  });
});

describe("isValidTargetUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(isValidTargetUrl("https://example.com/x?y=1")).toBe(true);
    expect(isValidTargetUrl("http://localhost:3000")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isValidTargetUrl("ftp://example.com")).toBe(false);
    expect(isValidTargetUrl("javascript:alert(1)")).toBe(false);
    expect(isValidTargetUrl("//example.com")).toBe(false);
    expect(isValidTargetUrl("example.com")).toBe(false);
    expect(isValidTargetUrl("")).toBe(false);
  });
});
