import { NextRequest, NextResponse } from "next/server";
import { ensureIndex } from "@/lib/index";
import { searchFor } from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 2000);
  if (!q) return NextResponse.json({ hits: [] });

  const index = await ensureIndex();
  const hits = searchFor(q, index.chunks, 5);
  return NextResponse.json({
    hits: hits.map((h) => ({
      id: h.chunk.id,
      source: h.chunk.source,
      page: h.chunk.page,
      heading: h.chunk.heading,
      text: h.chunk.text,
      score: Math.round(h.score * 100) / 100,
    })),
  });
}