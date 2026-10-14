import { z } from "zod";
import { compareSync } from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, sameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origen no permitido" }, { status: 403 });
  try {
    const { email, password } = z
      .object({
        email: z.email().max(100),
        password: z.string().min(1).max(128),
      })
      .parse(await req.json());
    const key = email.toLowerCase();
    const now = Date.now();
    const attempt = db
      .prepare("SELECT count,expires FROM attempts WHERE key=?")
      .get(key) as { count: number; expires: number } | undefined;
    if (attempt && attempt.expires > now && attempt.count >= 8)
      return Response.json(
        { error: "Demasiados intentos. Espera 15 minutos." },
        { status: 429 },
      );
    const account = db.prepare("SELECT * FROM users WHERE email=?").get(key) as
      { id: number; password: string } | undefined;
    if (!account || !compareSync(password, account.password)) {
      db.prepare(
        "INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END",
      ).run(key, now + 900000, now, now);
      return Response.json(
        { error: "Credenciales incorrectas" },
        { status: 401 },
      );
    }
    db.prepare("DELETE FROM attempts WHERE key=?").run(key);
    await createSession(account.id);
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Revisa el correo y la contraseña" },
      { status: 400 },
    );
  }
}
