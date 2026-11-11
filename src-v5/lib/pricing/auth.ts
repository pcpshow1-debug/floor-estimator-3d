import { adminPasswordHash, adminScryptParams } from "@/config/admin-gate";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const parts = adminPasswordHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = hexToBytes(parts[1]);
  const expected = hexToBytes(parts[2]);
  const { scrypt } = await import("scrypt-js");
  const encoded = new TextEncoder().encode(password);
  const derived = await scrypt(encoded, salt, adminScryptParams.N, adminScryptParams.r, adminScryptParams.p, expected.length);
  return timingSafeEqual(Uint8Array.from(derived), expected);
}

export const ADMIN_SESSION_KEY = "vipro-admin-ok";
