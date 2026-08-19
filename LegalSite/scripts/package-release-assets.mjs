import { cp, mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(siteRoot);
const output = join(siteRoot, "dist-pages");
const apkPath = join(workspaceRoot, "Builds", "DocVia-1.0.6-preview.apk");
const webExport = join(workspaceRoot, "Mobile", "DocVia", "dist-web-release");
const chunkSize = 24 * 1024 * 1024;

const apkInfo = await stat(apkPath);
if (apkInfo.size !== 90482160) {
  throw new Error(`Tamanho inesperado do APK: ${apkInfo.size}`);
}

const chunksDirectory = join(output, "downloads", "chunks");
await mkdir(chunksDirectory, { recursive: true });
const apk = await open(apkPath, "r");
const digest = createHash("sha256");

try {
  let position = 0;
  let index = 0;
  while (position < apkInfo.size) {
    const length = Math.min(chunkSize, apkInfo.size - position);
    const buffer = Buffer.allocUnsafe(length);
    const { bytesRead } = await apk.read(buffer, 0, length, position);
    if (bytesRead !== length) throw new Error(`Leitura incompleta da parte ${index}`);
    digest.update(buffer);
    await writeFile(join(chunksDirectory, `DocVia-1.0.6.apk.part-${index}.bin`), buffer);
    position += bytesRead;
    index += 1;
  }
} finally {
  await apk.close();
}

const actualSha256 = digest.digest("hex").toUpperCase();
const expectedSha256 = "0B1CF4A0E99E7678A01279B801EA646F5B828639C5EEB977CA09278EF15C8BF8";
if (actualSha256 !== expectedSha256) {
  throw new Error(`SHA-256 inesperado do APK: ${actualSha256}`);
}

const webIndexPath = join(webExport, "index.html");
const webIndex = (await readFile(webIndexPath, "utf8"))
  .replace('href="/favicon.ico"', 'href="/app/favicon.ico"')
  .replace('<html lang="en">', '<html lang="pt-BR">');

await mkdir(join(output, "app"), { recursive: true });
await writeFile(join(output, "app", "index.html"), webIndex, "utf8");
await cp(join(webExport, "favicon.ico"), join(output, "app", "favicon.ico"));
await cp(join(webExport, "_expo"), join(output, "_expo"), { recursive: true });
await cp(join(siteRoot, "worker", "_worker.js"), join(output, "_worker.js"));
await writeFile(
  join(output, "_routes.json"),
  JSON.stringify({ version: 1, include: ["/downloads/*"], exclude: [] }, null, 2),
  "utf8",
);

console.log("APK permanente e aplicação web incluídos no pacote do site.");
