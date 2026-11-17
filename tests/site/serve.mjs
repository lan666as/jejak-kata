// The site served from site/ on a free port, and one browser: what both checks start from.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const dir = new URL("../../site/", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" };
export const server = createServer(async (req, res) => {
  const path = join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  try { const body = await readFile(path); res.writeHead(200, { "content-type": types[extname(path)] || "text/plain" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
export const base = `http://localhost:${server.address().port}/`;
export const browser = await chromium.launch();
export const done = async (failures) => { await browser.close(); server.close(); process.exit(failures ? 1 : 0); };
