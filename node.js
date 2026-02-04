import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
app.use(express.json());

app.post("/fetch", async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: "URL を指定してください" });

  try {
    const response = await fetch(url);
    const html = await response.text();

    const $ = cheerio.load(html);

    // HTML 本体
    const htmlCode = html;

    // CSS（<style> と <link rel="stylesheet">）
    const cssList = [];

    $("style").each((_, el) => cssList.push($(el).html()));

    const linkPromises = $("link[rel='stylesheet']")
      .map(async (_, el) => {
        const href = $(el).attr("href");
        if (!href) return "";
        const cssUrl = new URL(href, url).href;
        const cssRes = await fetch(cssUrl);
        return await cssRes.text();
      })
      .get();

    const cssExternal = await Promise.all(linkPromises);
    const cssCode = [...cssList, ...cssExternal].join("\n\n");

    // JS（<script>）
    const jsList = [];

    $("script").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        // 外部JS
        jsList.push(fetch(new URL(src, url).href).then(r => r.text()));
      } else {
        // インラインJS
        jsList.push(Promise.resolve($(el).html()));
      }
    });

    const jsCode = (await Promise.all(jsList)).join("\n\n");

    res.json({
      html: htmlCode,
      css: cssCode,
      js: jsCode
    });

  } catch (e) {
    res.status(500).json({ error: "取得に失敗しました" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
