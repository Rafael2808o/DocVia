import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const { default: downloadWorker } = await import("../worker/_worker.js");

async function render(pathname) {
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

for (const [pathname, expected] of [
  ["/", "Seus documentos."],
  ["/privacidade", "Política de Privacidade"],
  ["/termos", "Termos de Uso"],
  ["/excluir-conta", "Excluir conta e dados"],
]) {
  test(`renderiza ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, new RegExp(expected, "i"));
    assert.match(html, /Rafael de Oliveira Silva/);
    if (pathname !== "/") {
      assert.match(html, /zrafaelxd07@gmail\.com/);
    }
    assert.doesNotMatch(html, /PENDENTE|PREENCHER|SUBSTITUIR|codex-preview/i);
  });
}

test("página de exclusão oferece um canal acionável", async () => {
  const response = await render("/excluir-conta");
  const html = await response.text();
  assert.match(html, /mailto:zrafaelxd07@gmail\.com/);
  assert.match(html, /Perfil/);
  assert.match(html, /Excluir conta/);
});

test("página de download separa APK Android de distribuição iOS", async () => {
  const response = await render("/baixar");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Baixar APK para Android/);
  assert.match(html, /Usar o DocVia agora/);
  assert.match(html, /href="\/app\/"/);
  assert.match(html, /TestFlight em preparação/);
  assert.match(html, /APK não é compatível com iOS/);
  assert.match(html, /href="\/downloads\/DocVia-1\.0\.6\.apk"/);
  assert.match(html, /Versão 1\.0\.6 \(código 7\)/);
  const exported = await readFile(new URL("../dist-pages/baixar/index.html", import.meta.url), "utf8");
  assert.match(exported, /Baixar APK para Android/);
  const webApp = await readFile(new URL("../dist-pages/app/index.html", import.meta.url), "utf8");
  assert.match(webApp, /_expo\/static\/js\/web/);
});

test("worker transmite todas as partes do APK em ordem", async () => {
  const assets = {
    fetch: async (request) => {
      const match = new URL(request.url).pathname.match(/part-(\d+)\.bin$/);
      return match
        ? new Response(Uint8Array.of(Number(match[1])))
        : new Response("asset", { status: 200 });
    },
  };

  const response = await downloadWorker.fetch(
    new Request("https://docvia.example/downloads/DocVia-1.0.6.apk"),
    { ASSETS: assets },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition") ?? "", /DocVia-1\.0\.6\.apk/);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), Uint8Array.of(0, 1, 2, 3));

  const head = await downloadWorker.fetch(
    new Request("https://docvia.example/downloads/DocVia-1.0.6.apk", { method: "HEAD" }),
    { ASSETS: assets },
  );
  assert.equal(head.headers.get("content-length"), "90482160");
});
