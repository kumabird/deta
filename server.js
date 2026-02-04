import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

    // iframe ブロック解除（最重要）
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");

    // CORS 回避
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");

    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).send("proxy error");
  }
});

app.post("/fetch", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const html = await r.text();

    res.json({
      html,
      base: url
    });
  } catch (e) {
    res.status(500).json({ error: "fetch error" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(3000, () => console.log("running 3000"));
