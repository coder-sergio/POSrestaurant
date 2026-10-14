import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { digest, sameOrigin } from "@/lib/auth";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const jar = await cookies();
  const token = jar.get("pos_session")?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE id=?").run(digest(token));
  jar.delete("pos_session");
  return Response.json({ ok: true });
}
