import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { generateCode } from "./generator";

/** Every personal key carries this prefix so it is recognisable in a log or a paste. */
export const KEY_PREFIX = "pwsh_";
const SECRET_LENGTH = 32;

export interface KeyRecord {
  /** sha256 of the plaintext key, hex. Also the blob key. */
  hash: string;
  userId: string;
  label: string;
  /** First few visible characters, for telling keys apart in the UI. */
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
}

export function keysStore() {
  return getStore({ name: "keys", consistency: "strong" });
}

/** Keys are stored only as a hash; the plaintext exists once, in the mint response. */
export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function looksLikeApiKey(token: string): boolean {
  return token.startsWith(KEY_PREFIX);
}

/**
 * Mint a key for a user. Returns the plaintext alongside the stored record —
 * this is the only moment the plaintext exists, and callers must not persist it.
 */
export async function mintKey(
  userId: string,
  label: string,
): Promise<{ plaintext: string; record: KeyRecord }> {
  const plaintext = KEY_PREFIX + generateCode(SECRET_LENGTH);
  const record: KeyRecord = {
    hash: hashKey(plaintext),
    userId,
    label,
    prefix: plaintext.slice(0, KEY_PREFIX.length + 4),
    createdAt: new Date().toISOString(),
  };
  await keysStore().setJSON(record.hash, record);
  return { plaintext, record };
}

/** Look a presented key up by hashing it — no scanning, no timing signal. */
export async function lookupKey(plaintext: string): Promise<KeyRecord | null> {
  return (await keysStore().get(hashKey(plaintext), {
    type: "json",
  })) as KeyRecord | null;
}

export async function getKey(hash: string): Promise<KeyRecord | null> {
  return (await keysStore().get(hash, { type: "json" })) as KeyRecord | null;
}

export async function listKeysFor(userId: string): Promise<KeyRecord[]> {
  const store = keysStore();
  const { blobs } = await store.list();
  const records = await Promise.all(
    blobs.map(
      async ({ key }) =>
        (await store.get(key, { type: "json" })) as KeyRecord | null,
    ),
  );
  return records
    .filter((k): k is KeyRecord => k !== null && k.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeKey(hash: string): Promise<void> {
  await keysStore().delete(hash);
}

/** Revoke every key a user holds — used when their access is withdrawn. */
export async function revokeAllFor(userId: string): Promise<number> {
  const keys = await listKeysFor(userId);
  await Promise.all(keys.map((k) => revokeKey(k.hash)));
  return keys.length;
}

/** Record use, best-effort: a failed touch must never fail the request. */
export async function touchKey(record: KeyRecord): Promise<void> {
  try {
    await keysStore().setJSON(record.hash, {
      ...record,
      lastUsedAt: new Date().toISOString(),
    });
  } catch {
    // Usage timestamps are a convenience, not a correctness concern.
  }
}

/** The shape sent to the browser — never includes anything key-equivalent. */
export function publicKey(record: KeyRecord) {
  return {
    hash: record.hash,
    label: record.label,
    prefix: record.prefix,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
  };
}
