import { user, sameOrigin } from "@/lib/auth";
import { execute, snapshot } from "@/lib/pos";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const actor = await user();
  if (!actor) return Response.json({ error: "Inicia sesión" }, { status: 401 });
  try {
    return Response.json(snapshot(actor));
  } catch {
    return Response.json(
      { error: "No pudimos cargar los datos. Reintenta." },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const actor = await user();
  if (!actor) return Response.json({ error: "Inicia sesión" }, { status: 401 });
  try {
    return Response.json(execute(actor, await req.json()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("permiso"))
      return Response.json({ error: message }, { status: 403 });
    const safe = [
      "Stock",
      "Ingredientes",
      "La mesa",
      "La cuenta",
      "Abre tu",
      "Efectivo",
      "No hay",
      "Solo se",
      "El plato",
      "Mesa inexistente",
      "Plato inexistente",
    ];
    return Response.json(
      {
        error: safe.some((s) => message.startsWith(s))
          ? message
          : "No se pudo completar la operación. Revisa los datos y reintenta.",
      },
      { status: 400 },
    );
  }
}
