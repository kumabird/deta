import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// public フォルダを公開
app.use(express.static("public"));

// トップページ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// HTML / CSS / JS を取得する API
app.post("/fetch", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL を指定してください" });

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // HTML
    const htmlCode = html;

    // CSS
    const cssList = [];
    $("style").each((_, el) => cssList.push($(el).html()));

    const cssExternal = await Promise.all(
      $("link[rel='stylesheet']")
        .map((_, el) => {
          const href = $(el).attr("href");
          if (!href) return "";
          const cssUrl = new URL(href, url).href;
          return fetch(cssUrl).then(r => r.text());
        })
        .get()
    );

    const cssCode = [...cssList, ...cssExternal].join("\n\n");

    // JS
    const jsList = await Promise.all(
      $("script")
        .map((_, el) => {
          const src = $(el).attr("src");
          if (src) {
            const jsUrl = new URL(src, url).href;
            return fetch(jsUrl).then(r => r.text());
          } else {
            return Promise.resolve($(el).html());
          }
        })
        .get()
    );

    const jsCode = jsList.join("\n\n");

    res.json({ html: htmlCode, css: cssCode, js: jsCode });
  } catch (e) {
    res.status(500).json({ error: "取得に失敗しました" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
