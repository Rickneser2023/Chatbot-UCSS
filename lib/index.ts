import path from "path";
import { promises as fs } from "fs";
import { ingestPdfFile } from "./ingest";
import { buildWebChunks } from "./web";
import type { Index } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DOCS_JSON = path.join(DATA_DIR, "docs.json");
const PDFS_DIR = path.join(DATA_DIR, "pdfs");

let cached: Index | null = null;

async function listPdfs(): Promise<string[]> {
  await fs.mkdir(PDFS_DIR, { recursive: true });
  const files = await fs.readdir(PDFS_DIR);
  return files.filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
}

async function rebuild(
  pdfs: string[],
  web: { chunks: Index["chunks"]; pageCount: number; crawledAt: string }
): Promise<Index> {
  const now = new Date().toISOString();
  const documents: Index["documents"] = [];
  const chunks: Index["chunks"] = [];

  for (const file of pdfs) {
    const { chunks: fileChunks, pages } = await ingestPdfFile(path.join(PDFS_DIR, file), file);
    documents.push({ name: file, pages, addedAt: now });
    chunks.push(...fileChunks.map((c) => ({ ...c, kind: "pdf" as const })));
  }

  chunks.push(...web.chunks);

  return { documents, chunks, _pdfs: pdfs, _web: { pages: web.pageCount, crawledAt: web.crawledAt } };
}

function matchesCurrent(
  index: Index,
  pdfs: string[],
  web: { pageCount: number; crawledAt: string }
): boolean {
  return (
    index._pdfs.join("|") === pdfs.join("|") &&
    index._web.pages === web.pageCount &&
    index._web.crawledAt === web.crawledAt
  );
}

async function loadCachedIndex(): Promise<Index | null> {
  try {
    const raw = await fs.readFile(DOCS_JSON, "utf8");
    return JSON.parse(raw) as Index;
  } catch {
    return null;
  }
}

export async function ensureIndex(): Promise<Index> {
  const pdfs = await listPdfs();
  const web = await buildWebChunks();
  if (cached && matchesCurrent(cached, pdfs, web)) return cached;
  const disk = await loadCachedIndex();
  if (disk && matchesCurrent(disk, pdfs, web)) {
    cached = disk;
    return disk;
  }
  const index = await rebuild(pdfs, web);
  try {
    await fs.writeFile(DOCS_JSON, JSON.stringify(index, null, 2));
  } catch { /* el índice en memoria sigue funcionando */ }
  cached = index;
  return index;
}

export async function resetCache(): Promise<void> {
  cached = null;
}

export { PDFS_DIR };