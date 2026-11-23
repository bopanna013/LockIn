import { describe, expect, it } from "vitest";
import { ANONYMOUS, hasGlobalRole, type Actor } from "./actor";
import { NotFoundError, ValidationError, isDomainError } from "./errors";
import { err, ok } from "./result";

describe("domain errors", () => {
  it("are recognisable and carry a kind", () => {
    const error = new NotFoundError("Branch not found");
    expect(isDomainError(error)).toBe(true);
    expect(error.kind).toBe("not_found");
    expect(error.name).toBe("NotFoundError");
    expect(isDomainError(new Error("boom"))).toBe(false);
  });

  it("keep field errors for validation failures", () => {
    const error = new ValidationError("Invalid", { email: ["Required"] });
    expect(error.fieldErrors.email).toEqual(["Required"]);
  });
});

describe("result helpers", () => {
  it("builds ok and err values", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err("x")).toEqual({ ok: false, error: "x" });
  });
});

describe("actor roles", () => {
  it("never grants roles to anonymous actors", () => {
    expect(hasGlobalRole(ANONYMOUS, "admin")).toBe(false);
  });

  it("checks global roles for users", () => {
    const editor: Actor = { type: "user", userId: "u1", orgId: "o1", globalRoles: ["editor"] };
    expect(hasGlobalRole(editor, "editor")).toBe(true);
    expect(hasGlobalRole(editor, "admin")).toBe(false);
  });
});
