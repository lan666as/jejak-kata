// The site served from site/ on a free port, and one browser: what every check starts from. Text is sent gzipped to a
// browser that accepts it, as a static host (GitHub Pages) sends it. The browser is Chromium, or WebKit (Safari's
// engine) where ENGINE=webkit (webkit.mjs).
import { chromium, webkit } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { gzipSync } from "node:zlib";
const dir = new URL("../../site/", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" };
const zipped = new Map();
export const server = createServer(async (req, res) => {
  const path = join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  try {
    const type = types[extname(path)] || "text/plain", gzip = type !== "font/woff2" && /gzip/.test(req.headers["accept-encoding"] || "");
    let body = await readFile(path);
    if (gzip) body = zipped.get(path) || zipped.set(path, gzipSync(body)).get(path);
    res.writeHead(200, { "content-type": type, ...(gzip ? { "content-encoding": "gzip" } : {}) });
    res.end(body);
  }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
export const base = `http://localhost:${server.address().port}/`;
export const browser = await (process.env.ENGINE === "webkit" ? webkit : chromium).launch();
export const done = async (failures) => { await browser.close(); server.close(); process.exit(failures ? 1 : 0); };
