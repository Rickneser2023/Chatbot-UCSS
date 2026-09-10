import path from "path";
import { promises as fs } from "fs";
import { extractText, getDocumentProxy } from "unpdf";
import { normalize, tokenize, type Chunk } from "./types";

const MAX_CHUNK = 1000;
const HEADING_RE =
  /^(ART[IÍ]CULO\s+\d+[\w.\u00b0]*|CAP[IÍ]TULO\s+[IVXLCDM]+|SECCI[OÓ]N\b|ANEXO\b)/i;
const NOISE_RE =
  /^(REGLAMENTO GENERAL DE ADMISI[OÓ]N.*|P[ÁA]GINA\s+\d+\s+DE\s+\d+.*|VERSI[OÓ]N|0?[1-9]\d*|\.\.\.|RESOLNO\.)$/i;
const NOISE_INLINE_RE = /\.\.\.\/ResolNo\./;function cleanParagraph(raw: string): string | null {
  const line = raw.replace(/\s+/g, " ").trim();
  if (!line) return null;
  if (NOISE_RE.test(line)) return null;
  if (NOISE_INLINE_RE.test(line)) line.replace(NOISE_INLINE_RE, "");
  if (!line.trim() || /CU\/R|RESOLNO/i.test(line)) return null;
  return line.replace(/\s+/g, " ").trim();
}

function toUint8Array(data: Uint8Array): Uint8Array {
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

export async function ingestPdfFile(filePath: string, fileName: string): Promise<{ chunks: Chunk[]; pages: number }> {
  const buffer = await fs.readFile(filePath);
  return ingestPdf(toUint8Array(buffer), fileName);
}

export async function ingestPdf(buffer: Uint8Array, fileName: string): Promise<{ chunks: Chunk[]; pages: number }> {
  const pdf = await getDocumentProxy(buffer);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pageTexts = Array.isArray(text) ? text : [text];
  const chunks = chunkText(pageTexts, fileName);
  return { chunks, pages: totalPages };
}

function chunkText(pageTexts: string[], source: string): Chunk[] {
  const chunks: Chunk[] = [];
  let acc: string[] = [];
  let accLen = 0;
  let currentPage = 1;
  let currentHeading = "";

  const flush = () => {
    if (acc.length === 0) return;
    const text = acc.join(" ").replace(/\s+/g, " ").trim();
    acc = [];
    accLen = 0;
    if (!text) return;
    const textNorm = normalize(text);
    chunks.push({
      id: `${source}::p${currentPage}::${chunks.length}`,
      source,
      text,
      textNorm,
      page: currentPage,
      heading: currentHeading,
    });
  };

  for (let i = 0; i < pageTexts.length; i++) {
    currentPage = i + 1;

    for (const raw of pageTexts[i].split(/\n+/)) {
      const para = cleanParagraph(raw);
      if (!para) continue;
      if (HEADING_RE.test(para)) {
        currentHeading = para.slice(0, 80);
      }
      if (accLen + para.length > MAX_CHUNK && acc.length > 0) flush();
      acc.push(para);
      accLen += para.length + 1;
      if (accLen >= MAX_CHUNK) flush();
    }
    flush();
  }
  flush();
  return chunks;
}

export { tokenize };