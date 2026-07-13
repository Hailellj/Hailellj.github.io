import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://resume.example/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished resume", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>廖丽君 Haile \| AI Marketing &amp; GTM<\/title>/i);
  assert.match(html, /class="resume-slide is-visible"/);
  assert.match(html, /\/backgrounds\/resume-11\.png/);
  assert.match(html, /阅读文字版/);
  assert.equal((html.match(/class="section-rail__dot"/g) ?? []).length, 8);
  assert.match(html, /noindex, nofollow/);
  assert.doesNotMatch(html, /codex-preview|Starter Project|Your site is taking shape/i);
});

test("keeps all slides, fonts, and source hyperlinks", async () => {
  const [dataText, renderText, backgroundFiles, fontFiles] = await Promise.all([
    readFile(new URL("app/resume-data.json", projectRoot), "utf8"),
    readFile(new URL("app/ppt-render-data.json", projectRoot), "utf8"),
    readdir(new URL("public/backgrounds/", projectRoot)),
    readdir(new URL("public/fonts/ppt/", projectRoot)),
  ]);
  const data = JSON.parse(dataText);
  const renderData = JSON.parse(renderText);
  const links = data.slides.flatMap((slide) => slide.links.map((link) => link.url));

  assert.equal(data.slides.length, 11);
  assert.equal(renderData.slides.length, 11);
  assert.equal(backgroundFiles.filter((file) => file.endsWith(".png")).length, 11);
  assert.equal(fontFiles.filter((file) => file.endsWith(".woff2")).length, 28);
  assert.ok(renderData.slides.every((slide) => slide.lines.length > 0));
  assert.equal(links.length, 16);
  assert.equal(new Set(links).size, 16);
  assert.ok(links.every((url) => /^https:\/\//.test(url)));
});
