import { getDatabase, getSessionByToken, SESSION_TTL_MS, type ActiveSession } from "@lockin/db";
import { cookies } from "next/headers";
import { serverEnv } from "@/env";

export const SESSION_COOKIE_NAME = "lockin_session";

export function appDb() {
  const url = serverEnv().DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return getDatabase(url, { applicationName: "lockin-web" });
}

export async function getCurrentSession(): Promise<ActiveSession | null> {
  const env = serverEnv();
  if (!env.DATABASE_URL) return null;
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;
  return getSessionByToken(appDb(), rawToken);
}

export async function setSessionCookie(rawToken: string): Promise<void> {
  const env = serverEnv();
  const isHttps = env.APP_URL.startsWith("https://");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
