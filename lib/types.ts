export interface Chunk {
  id: string;
  source: string;
  text: string;
  textNorm: string;
  page: number;
  heading: string;
  kind?: "pdf" | "web";
  url?: string;
  title?: string;
}

export interface Index {
  documents: { name: string; pages: number; addedAt: string }[];
  chunks: Chunk[];
  _pdfs: string[];
  _web: { pages: number; crawledAt: string };
}

export interface WebPage {
  url: string;
  title: string;
  category: string;
  paragraphs: string[];
}

export interface WebPagesFile {
  crawledAt: string;
  pages: WebPage[];
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "del", "al", "un", "una", "unos", "unas",
  "en", "y", "o", "u", "para", "por", "que", "con", "es", "se", "su", "sus",
  "me", "mi", "lo", "le", "no", "a", "este", "esta", "estos", "estas", "ser",
]);

export function tokenize(norm: string): string[] {
  return norm
    .replace(/[°]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}