/**
 * Base class for expected, user-facing business failures.
 * Unexpected failures (bugs, infrastructure) should throw plain Errors instead.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  /** HTTP-ish category the presentation layer can map to a status code. */
  abstract readonly kind: "validation" | "not_found" | "forbidden" | "conflict" | "unauthenticated";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = "not_found";
  readonly kind = "not_found";
}

export class ForbiddenError extends DomainError {
  readonly code = "forbidden";
  readonly kind = "forbidden";
}

export class UnauthenticatedError extends DomainError {
  readonly code = "unauthenticated";
  readonly kind = "unauthenticated";
}

export class ValidationError extends DomainError {
  readonly code = "validation_failed";
  readonly kind = "validation";

  constructor(
    message: string,
    readonly fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly code = "conflict";
  readonly kind = "conflict";
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
