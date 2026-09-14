import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const URLS_FILE = path.join(__dirname, "ucss-urls.json");
const OUT_FILE = path.join(ROOT, "data", "web", "pages.json");

const USER_AGENT =
  "Mozilla/5.0 (compatible; UCSS-Chatbot/1.0; chatbot-ucss educativo; +https://www.ucss.edu.pe)";
const DELAY_MS = 600;
const TIMEOUT_MS = 30_000;

const NOISE_CLASS_RE =
  /menu|nav|footer|header|toolbar|cookie|social|breadcrumb|pagination|banner|carousel|slider|widget|share|promo|hamburger|offcanvas|accordion|drawer|modal/i;

const LAYOUT_MODULE_RE =
  /(?:gk|sp|t3)[-_](?:bottom|footer|copyright|topbar|social)/i;

const CONTAINER_SELECTORS = [
  "article",
  ".item-page",
  ".com-content-article",
  "#gk-mainbody",
  "#sp-main-body",
  "#sp-component",
  ".sppb-content-article",
  "main",
];

function removeNoise($) {
  $("script, style, noscript, nav, footer, header, iframe, svg, form, button, [aria-hidden]").remove();
  $("*").each((_, el) => {
    const $el = $(el);
    const idCls = `${$el.attr("id") || ""} ${$el.attr("class") || ""}`;
    if (LAYOUT_MODULE_RE.test(idCls)) {
      $el.remove();
      return;
    }
    if (NOISE_CLASS_RE.test(idCls)) {
      if ($el.text().trim().length < 6000) $el.remove();
    }
  });
}

function pickContainer($) {
  for (const sel of CONTAINER_SELECTORS) {
    const $c = $(sel).first();
    const text = $c.text().replace(/\s+/g, " ").trim();
    if (text.length > 400) return $c;
  }
  return $("body");
}

function htmlToParagraphs($, $root) {
  const lines = [];
  const seen = new Set();
  const drop =
    /^(inicio|home|ingresar|ver carreras|leer más|leer màs|más información|publicar|convocatoria|documentos|descargar|anterior|siguiente|contáctenos|regístrate aquí|enviar)$/i;

  $root.find("h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,blockquote,pre,caption").each((_, el) => {
    const ancestor = $root.find(el).parents().toArray().find((p) => seen.has(p));
    if (ancestor) return;
    let t = $(el).text().replace(/\s+/g, " ").trim();
    if (!t || t.length > 4000) return;
    if (drop.test(t)) return;
    seen.add(el);
    const tag = el.name.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      t = `### ${t}`;
      if (lines.length && lines[lines.length - 1].startsWith("### ") && lines[lines.length - 1] === t) {
        return;
      }
    }
    lines.push(t);
  });

  const out = [];
  for (const line of lines) {
    if (line === out[out.length - 1]) continue;
    if (/©|\bTodos los derechos reservados\b|MIEMBRO DE/i.test(line) && !/^(###)/.test(line)) continue;
    if (/^(revista campucss|campus virtual|mas servicios|ingresar|inicio|politica de privacidad|terminos y condiciones)$/i.test(line)) continue;
    if (out.includes(line)) continue;
    out.push(line);
  }
  return out;
}

function slugify(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

async function fetchPage(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-PE, es;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return html;
  } finally {
    clearTimeout(timer);
  }
}

function parsePage(url, html) {
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    url;
  removeNoise($);
  const $root = pickContainer($);
  const paragraphs = htmlToParagraphs($, $root);
  return { title, paragraphs };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const urls = JSON.parse(await fs.readFile(URLS_FILE, "utf8"));
  await fs.mkdir(path.join(ROOT, "data", "web"), { recursive: true });

  const pages = [];
  let ok = 0;
  let failed = 0;

  for (const item of urls) {
    const { url, category } = item;
    try {
      let html = await fetchPage(url).catch(async () => {
        await sleep(DELAY_MS * 3);
        return fetchPage(url);
      });
      const { title, paragraphs } = parsePage(url, html);
      if (paragraphs.length < 5 && paragraphs.join(" ").length < 200) {
        throw new Error("contenido principal no detectado");
      }
      pages.push({ url, title, category, slug: slugify(url), paragraphs });
      ok++;
      process.stdout.write(`OK   ${url} (${title.slice(0, 60)}) — ${paragraphs.length} párrafos\n`);
    } catch (err) {
      failed++;
      process.stdout.write(`FAIL ${url} — ${String(err.message || err).slice(0, 80)}\n`);
    }
    await sleep(DELAY_MS);
  }

  const payload = { crawledAt: new Date().toISOString(), pages };
  await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2));
  process.stdout.write(
    `\nResumen: ${ok} páginas OK, ${failed} fallidas. Guardado en ${path.relative(ROOT, OUT_FILE)}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});