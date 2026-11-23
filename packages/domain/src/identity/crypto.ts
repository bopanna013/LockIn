import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const SCRYPT_KEYLEN = 64;

/**
 * Hash a user password using Node's built-in `scrypt` KDF with a 16-byte random salt.
 * Format: `scrypt$<hexSalt>$<hexDerivedKey>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password.normalize("NFKC"), salt, SCRYPT_KEYLEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hexKey] = parts;
  if (!salt || !hexKey) return false;
  const expected = Buffer.from(hexKey, "hex");
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const actual = (await scrypt(password.normalize("NFKC"), salt, SCRYPT_KEYLEN)) as Buffer;
  return timingSafeEqual(actual, expected);
}

/** SHA-256 hex digest for opaque session/verification tokens and OTPs. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Constant-time comparison of two SHA-256 hex strings. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length % 2 !== 0) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** High-entropy URL-safe token (256 bits by default). */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Cryptographically random 6-digit numeric OTP (000000–999999). */
export function generateSixDigitOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
