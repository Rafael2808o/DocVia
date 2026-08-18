import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

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
  assert.match(html, /TestFlight em preparação/);
  assert.match(html, /APK não é compatível com iOS/);
  assert.match(html, /expo\.dev\/artifacts\/eas\/[A-Za-z0-9_-]+\.apk/);
  assert.match(html, /Versão 1\.0\.6 \(código 7\)/);
  const exported = await readFile(new URL("../dist-pages/baixar/index.html", import.meta.url), "utf8");
  assert.match(exported, /Baixar APK para Android/);
});
