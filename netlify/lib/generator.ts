const BASE62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const CODE_LENGTH = 6;

/** Generate a random Base62 short code, unbiased via rejection sampling. */
export function generateCode(length = CODE_LENGTH): string {
  const max = 256 - (256 % BASE62.length); // 248: reject bytes above to avoid modulo bias
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < max && out.length < length) out += BASE62[b % BASE62.length];
    }
  }
  return out;
}
