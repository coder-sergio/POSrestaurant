import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { db, type Role } from "./db";
export type User = { id: number; name: string; email: string; role: Role };
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function user(): Promise<User | null> {
  const token = (await cookies()).get("pos_session")?.value;
  if (!token) return null;
  return (
    (db
      .prepare(
        "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>?",
      )
      .get(digest(token), Date.now()) as User | undefined) || null
  );
}
export async function createSession(id: number) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    digest(token),
    id,
    Date.now() + 8 * 60 * 60 * 1000,
  );
  (await cookies()).set("pos_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const protocol =
      request.headers.get("x-forwarded-proto") ||
      new URL(request.url).protocol.slice(0, -1);
    return (
      parsed.host === request.headers.get("host") &&
      parsed.protocol === `${protocol}:`
    );
  } catch {
    return false;
  }
}
