import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { ensureIndex, PDFS_DIR, resetCache } from "@/lib/index";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Adjunta un archivo PDF" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 415 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "El PDF supera el tamaño máximo de 25 MB" }, { status: 413 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  await fs.mkdir(PDFS_DIR, { recursive: true });
  const dest = path.join(PDFS_DIR, safeName);
  await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));

  await resetCache();
  const index = await ensureIndex();
  const doc = index.documents.find((d) => d.name === safeName);

  return NextResponse.json({ ok: true, document: doc, totalChunks: index.chunks.length });
}