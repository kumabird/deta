import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------
// 1. 完全プロキシ（画像 / CSS / JS / API / manifest / font / favicon）
// ------------------------------------------------------
app.get("/proxy", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("no url");

  try {
    const r = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const buffer = await r.arrayBuffer();
    const contentType = r.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Content-Type", contentType);

    // ★ ここが最重要 ★
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Headers", "*");

    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).send("proxy error");
  }
});

// ------------------------------------------------------
// 2. HTML 内の URL をすべて proxy 化（相対パス完全対応）
// ------------------------------------------------------
function rewriteAllUrls(html, baseUrl) {
  return html.replace(/(src|href)=["']([^"']+)["']/g, (m, attr, url) => {
    const absolute = new URL(url, baseUrl).href;
    return `${attr}="/proxy?url=${absolute}"`;
  });
}

// ------------------------------------------------------
// 3. フレーム再帰解析（frameset → frame → frame）
// ------------------------------------------------------
async function fetchFrame(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const frames = $("frame");
  if (frames.length > 0) {
    const frameData = [];

    for (const el of frames.toArray()) {
      const src = $(el).attr("src") || "";
      const frameUrl = new URL(src, url).href;

      const content = await fetchFrame(frameUrl);

      frameData.push({
        src: frameUrl,
        content
      });
    }

    return {
      type: "frameset",
      frames: frameData
    };
  }

  return {
    type: "html",
    html: rewriteAllUrls(html, url)
  };
}

// ------------------------------------------------------
// 4. /fetch（フレーム再帰 + SPA対応）
// ------------------------------------------------------
app.post("/fetch", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const result = await fetchFrame(url);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "fetch error" });
  }
});

// ------------------------------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("running", port));
