import { NextResponse } from "next/server";
import { ensureIndex } from "@/lib/index";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const index = await ensureIndex();
  return NextResponse.json({
    documents: index.documents,
    web: {
      pages: index._web.pages,
      crawledAt: index._web.crawledAt,
    },
  });
}