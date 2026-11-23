import { ForbiddenError, UnauthenticatedError } from "../shared/errors";
import type { Actor, GlobalRole } from "../shared/actor";

export type OrgRole = "owner" | "org_admin" | "counselor" | "student";

export type Permission =
  | "cms:read_drafts"
  | "cms:edit_content"
  | "cms:publish_content"
  | "cms:translate_content"
  | "admin:manage_users"
  | "admin:view_audit_logs";

const GLOBAL_ROLE_PERMISSIONS: Readonly<Record<GlobalRole, readonly Permission[]>> = {
  admin: [
    "cms:read_drafts",
    "cms:edit_content",
    "cms:publish_content",
    "cms:translate_content",
    "admin:manage_users",
    "admin:view_audit_logs",
  ],
  editor: ["cms:read_drafts", "cms:edit_content", "cms:publish_content", "cms:translate_content"],
  translator: ["cms:read_drafts", "cms:translate_content"],
};

export function hasPermission(actor: Actor, permission: Permission): boolean {
  if (actor.type === "system") return true;
  if (actor.type !== "user") return false;
  return actor.globalRoles.some((role) => GLOBAL_ROLE_PERMISSIONS[role].includes(permission));
}

export function requireAuthenticatedUser(actor: Actor): Extract<Actor, { type: "user" }> {
  if (actor.type !== "user") {
    throw new UnauthenticatedError("Sign-in required.");
  }
  return actor;
}

export function requirePermission(actor: Actor, permission: Permission): void {
  if (actor.type === "anonymous") {
    throw new UnauthenticatedError("Sign-in required.");
  }
  if (!hasPermission(actor, permission)) {
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }
}

/** Build a URL-safe slug for a user's personal organization. */
export function buildPersonalOrgSlug(fullName: string, userId: string): string {
  const base = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const shortId = userId.replace(/-/g, "").slice(0, 10);
  return `personal-${base || "user"}-${shortId}`;
}
