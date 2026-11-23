import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

describe("server env", () => {
  it("applies safe defaults", () => {
    const env = parseServerEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("rejects malformed values with a readable error", () => {
    expect(() => parseServerEnv({ APP_URL: "not a url" })).toThrow(/APP_URL/);
    expect(() => parseServerEnv({ LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
