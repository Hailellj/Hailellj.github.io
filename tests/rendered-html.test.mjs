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
  assert.match(html, /\/slides\/slide-11\.png/);
  assert.match(html, /noindex, nofollow/);
  assert.doesNotMatch(html, /codex-preview|Starter Project|Your site is taking shape/i);
});

test("keeps all slides and source hyperlinks", async () => {
  const [dataText, slideFiles] = await Promise.all([
    readFile(new URL("app/resume-data.json", projectRoot), "utf8"),
    readdir(new URL("public/slides/", projectRoot)),
  ]);
  const data = JSON.parse(dataText);
  const links = data.slides.flatMap((slide) => slide.links.map((link) => link.url));

  assert.equal(data.slides.length, 11);
  assert.equal(slideFiles.filter((file) => file.endsWith(".png")).length, 11);
  assert.equal(links.length, 16);
  assert.equal(new Set(links).size, 16);
  assert.ok(links.every((url) => /^https:\/\//.test(url)));
});
