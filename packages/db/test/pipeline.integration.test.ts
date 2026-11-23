/**
 * Integration tests against a real PostgreSQL in Docker (Testcontainers).
 * Verifies the full bootstrap → migrate → seed pipeline and the privilege model.
 *
 *   pnpm test:integration   (requires Docker to be running)
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapDatabase } from "../src/bootstrap";
import { createDatabase } from "../src/client";
import { runMigrations } from "../src/migrate";
import { seedLocales } from "../src/seed/locales";

const PASSWORDS = {
  owner: "owner-password-for-tests-only",
  app: "app-password-for-tests-only-x",
  cms: "cms-password-for-tests-only-x",
};

let container: StartedPostgreSqlContainer;
let urlFor: (user: string, password: string) => string;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17-alpine")
    .withDatabase("lockin")
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  urlFor = (user, password) =>
    `postgres://${user}:${password}@${container.getHost()}:${container.getPort()}/lockin`;

  await bootstrapDatabase({
    adminUrl: urlFor("postgres", "postgres"),
    dbName: "lockin",
    passwords: PASSWORDS,
  });
  await runMigrations(urlFor("lockin_owner", PASSWORDS.owner));
});

afterAll(async () => {
  await container?.stop();
});

describe("database pipeline", () => {
  it("is idempotent: bootstrap and migrations can run twice", async () => {
    await bootstrapDatabase({
      adminUrl: urlFor("postgres", "postgres"),
      dbName: "lockin",
      passwords: PASSWORDS,
    });
    await runMigrations(urlFor("lockin_owner", PASSWORDS.owner));
  });

  it("creates the three schemas", async () => {
    const sql = postgres(urlFor("lockin_owner", PASSWORDS.owner), { max: 1 });
    const rows = await sql<{ nspname: string }[]>`
      select nspname from pg_namespace where nspname in ('content', 'student', 'system') order by nspname`;
    await sql.end();
    expect(rows.map((row) => row.nspname)).toEqual(["content", "student", "system"]);
  });

  it("seeds locales from the i18n registry", async () => {
    const { db, client } = createDatabase(urlFor("lockin_owner", PASSWORDS.owner), { max: 1 });
    await seedLocales(db);
    await seedLocales(db); // idempotent
    const rows = await client<{ code: string; enabled: boolean }[]>`
      select code, enabled from content.locales order by code`;
    await client.end();
    expect(rows).toEqual([
      { code: "en", enabled: true },
      { code: "hi", enabled: false },
      { code: "kn", enabled: false },
    ]);
  });
});

describe("privilege model", () => {
  it("lets the app role read content but not modify it", async () => {
    const sql = postgres(urlFor("lockin_app", PASSWORDS.app), { max: 1 });
    try {
      const rows = await sql`select code from content.locales`;
      expect(rows.length).toBeGreaterThan(0);
      await expect(sql`update content.locales set enabled = true`).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await sql.end();
    }
  });

  it("lets the CMS role write content", async () => {
    const sql = postgres(urlFor("lockin_cms", PASSWORDS.cms), { max: 1 });
    try {
      await sql`update content.locales set updated_at = now() where code = 'en'`;
    } finally {
      await sql.end();
    }
  });

  it("denies the CMS role any access to the student schema", async () => {
    const sql = postgres(urlFor("lockin_cms", PASSWORDS.cms), { max: 1 });
    try {
      await expect(sql`create table student.should_fail (id int)`).rejects.toThrow(
        /permission denied/,
      );
      const [row] = await sql<{ allowed: boolean }[]>`
        select has_schema_privilege('lockin_cms', 'student', 'USAGE') as allowed`;
      expect(row?.allowed).toBe(false);
    } finally {
      await sql.end();
    }
  });

  it("prevents app roles from creating objects in public", async () => {
    const sql = postgres(urlFor("lockin_app", PASSWORDS.app), { max: 1 });
    try {
      await expect(sql`create table public.oops (id int)`).rejects.toThrow(/permission denied/);
    } finally {
      await sql.end();
    }
  });

  it("returns NULL request context when none is set", async () => {
    const sql = postgres(urlFor("lockin_app", PASSWORDS.app), { max: 1 });
    try {
      const [row] = await sql<
        { user_id: string | null }[]
      >`select system.current_user_id() as user_id`;
      expect(row?.user_id).toBeNull();
    } finally {
      await sql.end();
    }
  });

  it("requires RLS on every student table (guardrail for future phases)", async () => {
    const sql = postgres(urlFor("lockin_owner", PASSWORDS.owner), { max: 1 });
    try {
      const rows = await sql<{ relname: string }[]>`
        select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'student' and c.relkind = 'r' and not c.relrowsecurity`;
      expect(rows.map((row) => row.relname)).toEqual([]);
    } finally {
      await sql.end();
    }
  });
});
