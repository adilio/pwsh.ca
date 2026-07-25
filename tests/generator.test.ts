import { describe, expect, it } from "vitest";
import { CODE_LENGTH, generateCode } from "../netlify/lib/generator";

describe("generateCode", () => {
  it("produces codes of the default length", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode()).toHaveLength(CODE_LENGTH);
    }
  });

  it("honors a custom length", () => {
    expect(generateCode(10)).toHaveLength(10);
  });

  it("only uses Base62 characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode()).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it("does not repeat across a reasonable sample", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateCode()));
    // 62^6 possibilities; 1000 draws colliding would indicate broken RNG.
    expect(seen.size).toBeGreaterThan(995);
  });
});
