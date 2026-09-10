import { normalize, tokenize, type Chunk } from "./types";

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export function searchFor(
  query: string,
  chunks: Chunk[],
  topK = 5
): SearchResult[] {
  const tokens = Array.from(new Set(tokenize(normalize(query))));
  if (tokens.length === 0 || chunks.length === 0) return [];

  const n = chunks.length;
  const docTokens = chunks.map((c) => c.textNorm.split(/[^a-z0-9]+/).filter((t) => t.length > 1));
  const df = new Map<string, number>();
  for (const toks of docTokens) {
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const dl = docTokens.map((t) => t.length);
  const avgdl = dl.reduce((a, b) => a + b, 0) / n;
  const k1 = 1.5;
  const b = 0.75;

  const scores = new Array<number>(n).fill(0);
  for (const t of tokens) {
    const dfT = df.get(t) ?? 0;
    const idf = Math.log(1 + (n - dfT + 0.5) / (dfT + 0.5));
    for (let i = 0; i < n; i++) {
      let tf = 0;
      for (const tok of docTokens[i]) if (tok === t) tf++;
      if (tf === 0) continue;
      const denom = k1 * (1 - b + b * dl[i] / avgdl) + tf;
      scores[i] += (idf * (k1 + 1) * tf) / denom;
    }
  }

  const queryNorm = normalize(query);
  return chunks
    .map((chunk, i) => ({
      chunk,
      score: scores[i] + (chunk.textNorm.includes(queryNorm) ? 2 : 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}