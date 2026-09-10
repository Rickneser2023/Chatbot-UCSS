import path from "path";
import { promises as fs } from "fs";
import { ingestPdfFile } from "./ingest";
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

async function rebuild(pdfs: string[]): Promise<Index> {
  const now = new Date().toISOString();
  const documents: Index["documents"] = [];
  const chunks: Index["chunks"] = [];

  for (const file of pdfs) {
    const { chunks: fileChunks, pages } = await ingestPdfFile(path.join(PDFS_DIR, file), file);
    documents.push({ name: file, pages, addedAt: now });
    chunks.push(...fileChunks);
  }

  return { documents, chunks, _pdfs: pdfs };
}

export async function ensureIndex(): Promise<Index> {
  const pdfs = await listPdfs();
  if (cached && cached.documents.length === pdfs.length) {
    const cachedNames = cached._pdfs.join("|");
    if (cachedNames === pdfs.join("|")) return cached;
  }
  const index = await rebuild(pdfs);
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