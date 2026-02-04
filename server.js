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

// プロキシ（SPA の API / 画像 / CSS / JS すべて対応）
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
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).send("proxy error");
  }
});

// URL 書き換え（HTML 内の src/href を全部 proxy 化）
function rewriteUrls(html, baseUrl) {
  return html.replace(/(src|href)=["']([^"']+)["']/g, (match, attr, url) => {
    if (url.startsWith("http")) {
      return `${attr}="/proxy?url=${url}"`;
    }
    const absolute = new URL(url, baseUrl).href;
    return `${attr}="/proxy?url=${absolute}"`;
  });
}

// フレーム再帰取得
async function fetchFrame(url) {
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  // frameset がある場合
  const frames = $("frame");
  if (frames.length > 0) {
    const frameData = [];

    for (const el of frames.toArray()) {
      const src = $(el).attr("src");
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

  // 通常の HTML
  return {
    type: "html",
    html: rewriteUrls(html, url)
  };
}

// /fetch API（フレーム再帰＋SPA対応）
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

// index.html を返す
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("running", port));
