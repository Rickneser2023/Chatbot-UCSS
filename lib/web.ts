import path from "path";
import { promises as fs } from "fs";
import { buildChunksFromParagraphs } from "./ingest";
import type { Chunk, WebPagesFile } from "./types";

const WEB_JSON = path.join(process.cwd(), "data", "web", "pages.json");

const REDUNDANT_SOURCES = new Set([
  "repositorio.ucss.edu.pe",
  "www.youtube.com",
  "camp.ucss.edu.pe",
  "oilse.ucss.edu.pe",
  "postgrado.ucss.edu.pe",
  "idiomas.ucss.edu.pe",
]);

export async function loadWebPagesFile(): Promise<WebPagesFile | null> {
  try {
    const raw = await fs.readFile(WEB_JSON, "utf8");
    return JSON.parse(raw) as WebPagesFile;
  } catch {
    return null;
  }
}

export function chunkWebPages(pages: WebPagesFile["pages"]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const page of pages) {
    if (REDUNDANT_SOURCES.has(new URL(page.url).hostname)) continue;
    const source = `${page.title} (UCSS)`;
    const pageChunks = buildChunksFromParagraphs(page.paragraphs, source, { maxChunk: 900 });
    for (const c of pageChunks) {
      c.kind = "web";
      c.url = page.url;
      c.title = page.title;
      chunks.push(c);
    }
  }
  return chunks;
}

export async function buildWebChunks(): Promise<{ chunks: Chunk[]; pageCount: number; crawledAt: string }> {
  const file = await loadWebPagesFile();
  if (!file) return { chunks: [], pageCount: 0, crawledAt: "" };
  const chunks = chunkWebPages(file.pages);
  return { chunks, pageCount: file.pages.length, crawledAt: file.crawledAt };
}