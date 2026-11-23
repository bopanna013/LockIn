import { describe, expect, it } from "vitest";
import {
  assertStudentDataAccessAllowed,
  calculateAgeYears,
  isMinorByDob,
  nextStatusAfterEmailVerification,
} from "../consent";
import {
  generateOpaqueToken,
  generateSixDigitOtp,
  hashPassword,
  safeEqualHex,
  sha256Hex,
  verifyPassword,
} from "../identity";
import { buildPersonalOrgSlug, hasPermission, requirePermission } from "../organization";
import { ANONYMOUS, type Actor } from "../shared";

describe("identity crypto", () => {
  it("hashes and verifies passwords with scrypt", async () => {
    const hash = await hashPassword("CorrectHorseBatteryStaple!99");
    expect(hash.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("CorrectHorseBatteryStaple!99", hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPassword!99", hash)).resolves.toBe(false);
  });

  it("produces 6-digit OTPs and constant-time SHA-256 comparisons", () => {
    const otp = generateSixDigitOtp();
    expect(otp).toMatch(/^\d{6}$/);
    const digest = sha256Hex(otp);
    expect(safeEqualHex(digest, sha256Hex(otp))).toBe(true);
    expect(safeEqualHex(digest, sha256Hex("000000"))).toBe(otp === "000000");
    expect(generateOpaqueToken().length).toBeGreaterThanOrEqual(40);
  });
});

describe("age gate & guardian consent policy", () => {
  const refDate = new Date("2026-11-23T00:00:00Z");

  it("computes age accurately across birthday boundaries", () => {
    expect(calculateAgeYears("2008-11-23", refDate)).toBe(18);
    expect(isMinorByDob("2008-11-23", refDate)).toBe(false);

    expect(calculateAgeYears("2008-11-24", refDate)).toBe(17);
    expect(isMinorByDob("2008-11-24", refDate)).toBe(true);
  });

  it("routes minors to pending_guardian after email verification", () => {
    expect(nextStatusAfterEmailVerification(true)).toBe("pending_guardian");
    expect(nextStatusAfterEmailVerification(false)).toBe("active");
  });

  it("blocks student data access unless account is active", () => {
    expect(() => assertStudentDataAccessAllowed("active")).not.toThrow();
    expect(() => assertStudentDataAccessAllowed("pending_guardian")).toThrow(/guardian consent/i);
    expect(() => assertStudentDataAccessAllowed("pending_verification")).toThrow(
      /verify your email/i,
    );
    expect(() => assertStudentDataAccessAllowed("restricted")).toThrow(/revoked/i);
  });
});

describe("organization RBAC", () => {
  it("enforces global role permissions", () => {
    const editor: Actor = { type: "user", userId: "u1", orgId: "o1", globalRoles: ["editor"] };
    expect(hasPermission(editor, "cms:publish_content")).toBe(true);
    expect(hasPermission(editor, "admin:manage_users")).toBe(false);
    expect(() => requirePermission(editor, "admin:manage_users")).toThrow(
      /Missing required permission/,
    );
    expect(() => requirePermission(ANONYMOUS, "cms:read_drafts")).toThrow(/Sign-in required/);
  });

  it("builds deterministic personal org slugs", () => {
    expect(buildPersonalOrgSlug("Aarav Sharma", "12345678-90ab-cdef-1234-567890abcdef")).toBe(
      "personal-aarav-sharma-1234567890",
    );
  });
});
