import { NextRequest, NextResponse } from "next/server";
import { ensureIndex } from "@/lib/index";
import { searchFor } from "@/lib/search";
import { askGroq } from "@/lib/groq";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { message?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const history = Array.isArray(body.history)
    ? body.history
        .slice(-10)
        .map((m) => ({
          role: m && m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(m && m.content ? m.content : "").slice(0, 2000),
        }))
        .filter((m) => m.content.trim().length > 0)
    : [];

  const index = await ensureIndex();
  const hits = searchFor(message, index.chunks, 6);
  const context = hits
    .map((h) => {
      const c = h.chunk;
      const origin =
        c.kind === "web"
          ? `[Sitio web UCSS: ${c.title ?? c.source} — ${c.url}]`
          : `[Documento PDF: ${c.source}, pág. ${c.page}]`;
      return `${origin}\n${c.text}`;
    })
    .join("\n\n");

  const apiKey = process.env.GROQ_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json({
      reply:
        "Todavía no puedo responder con IA: falta configurar la clave de Groq. Pedile al administrador que cree el archivo .env.local con GROQ_API_KEY.",
      hits: hits.map((h) => ({ id: h.chunk.id, score: Math.round(h.score * 100) / 100 })),
    });
  }

  try {
    const reply = await askGroq({ context, history, question: message, apiKey });
    return NextResponse.json({
      reply,
      hits: hits.map((h) => ({ id: h.chunk.id, score: Math.round(h.score * 100) / 100 })),
    });
  } catch (e) {
    return NextResponse.json({
      reply:
        "Lo siento, hubo un problema al conectar con el modelo. Intentalo de nuevo en unos segundos.",
      error: String(e),
    });
  }
}