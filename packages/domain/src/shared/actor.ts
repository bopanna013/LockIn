/**
 * Identity of whoever is performing an operation. Every domain service receives one,
 * so authorization is decided inside the domain layer — never only in the UI.
 */
export type GlobalRole = "admin" | "editor" | "translator";

export type Actor =
  | { type: "anonymous" }
  | {
      type: "user";
      userId: string;
      /** Active organization (a personal org for every student in the MVP). */
      orgId: string;
      globalRoles: readonly GlobalRole[];
    }
  | { type: "system"; reason: string };

export const ANONYMOUS: Actor = { type: "anonymous" };

export function hasGlobalRole(actor: Actor, role: GlobalRole): boolean {
  return actor.type === "user" && actor.globalRoles.includes(role);
}
