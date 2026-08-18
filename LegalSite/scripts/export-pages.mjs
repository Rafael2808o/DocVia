import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("pages-export", `${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const assets = {
  fetch: async () => new Response("Not found", { status: 404 }),
};

const routes = ["/", "/baixar", "/privacidade", "/termos", "/excluir-conta"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, "dist", "client"), output, { recursive: true });

for (const route of routes) {
  const response = await worker.fetch(
    new Request(`https://docvia-privacidade.pages.dev${route}`, {
      headers: { accept: "text/html" },
    }),
    { ASSETS: assets },
    { waitUntil() {}, passThroughOnException() {} },
  );

  if (!response.ok) {
    throw new Error(`Falha ao exportar ${route}: HTTP ${response.status}`);
  }

  const destination =
    route === "/"
      ? join(output, "index.html")
      : join(output, route.slice(1), "index.html");

  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, await response.text(), "utf8");
}

await writeFile(
  join(output, "_headers"),
  [
    "/*",
    "  X-Content-Type-Options: nosniff",
    "  X-Frame-Options: DENY",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Cloudflare Pages exportado em ${output}`);
