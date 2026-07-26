import { describe, expect, it } from "vitest";
import { KEY_PREFIX, hashKey, looksLikeApiKey } from "../netlify/lib/keys";

describe("api key hashing", () => {
  it("hashes stably, so the same key always finds its record", () => {
    expect(hashKey("pwsh_abc")).toBe(hashKey("pwsh_abc"));
  });

  it("produces a hex sha256 that does not contain the key", () => {
    const hash = hashKey("pwsh_supersecret");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("supersecret");
  });

  it("gives different keys different hashes", () => {
    expect(hashKey("pwsh_a")).not.toBe(hashKey("pwsh_b"));
  });

  it("recognises its own key format only", () => {
    expect(looksLikeApiKey(`${KEY_PREFIX}abc`)).toBe(true);
    expect(looksLikeApiKey("some-admin-token")).toBe(false);
    expect(looksLikeApiKey("")).toBe(false);
  });
});
