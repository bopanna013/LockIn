import { ForbiddenError } from "../shared/errors";

export const ADULT_AGE_YEARS = 18;
export const MIN_ALLOWED_AGE_YEARS = 12;
export const MAX_ALLOWED_AGE_YEARS = 80;

/**
 * Parse an ISO `YYYY-MM-DD` date string and compute the user's age in whole years
 * on `referenceDate` (compared in UTC / calendar components to avoid timezone drift).
 */
export function calculateAgeYears(
  dateOfBirthIso: string,
  referenceDate: Date = new Date(),
): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirthIso);
  if (!match) {
    throw new Error(`Invalid dateOfBirth format (expected YYYY-MM-DD): ${dateOfBirthIso}`);
  }
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth() + 1;
  const refDay = referenceDate.getUTCDate();

  let age = refYear - birthYear;
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age -= 1;
  }
  return age;
}

export function isMinorByDob(dateOfBirthIso: string, referenceDate: Date = new Date()): boolean {
  return calculateAgeYears(dateOfBirthIso, referenceDate) < ADULT_AGE_YEARS;
}

export type AccountStatus =
  "pending_verification" | "pending_guardian" | "active" | "restricted" | "suspended";

/**
 * Determine the next account status after the student verifies their email address.
 * - Adults (18+) transition straight to `active`.
 * - Minors (<18) transition to `pending_guardian` (DPDP Act 2023 Section 9 gate).
 */
export function nextStatusAfterEmailVerification(isMinor: boolean): AccountStatus {
  return isMinor ? "pending_guardian" : "active";
}

/**
 * Guard that throws ForbiddenError unless the user's account is `active`.
 * Every student-data read/write operation (profile, assessment, roadmap, progress)
 * must pass through this check.
 */
export function assertStudentDataAccessAllowed(status: AccountStatus): void {
  if (status === "active") return;
  if (status === "pending_guardian") {
    throw new ForbiddenError(
      "Parent or guardian consent is required before personal student data can be saved.",
    );
  }
  if (status === "pending_verification") {
    throw new ForbiddenError("Please verify your email address before continuing.");
  }
  if (status === "restricted") {
    throw new ForbiddenError(
      "Guardian consent was revoked. This account is restricted from saving or accessing personal data.",
    );
  }
  throw new ForbiddenError("This account is suspended.");
}
