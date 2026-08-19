const APK = {
  path: "/downloads/DocVia-1.0.6.apk",
  chunkBase: "/downloads/chunks/DocVia-1.0.6.apk.part-",
  chunkCount: 4,
  size: 90482160,
  sha256: "0B1CF4A0E99E7678A01279B801EA646F5B828639C5EEB977CA09278EF15C8BF8",
};

function downloadHeaders() {
  return {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": 'attachment; filename="DocVia-1.0.6.apk"',
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "X-DocVia-SHA256": APK.sha256,
  };
}

function streamApk(request, assets, context) {
  const stream = typeof globalThis.FixedLengthStream === "function"
    ? new globalThis.FixedLengthStream(APK.size)
    : new TransformStream();
  const writer = stream.writable.getWriter();

  const pump = (async () => {
    try {
      for (let index = 0; index < APK.chunkCount; index += 1) {
        const chunkUrl = new URL(`${APK.chunkBase}${index}.bin`, request.url);
        const response = await assets.fetch(new Request(chunkUrl));
        if (!response.ok || !response.body) {
          throw new Error(`Parte ${index} do APK indisponível`);
        }

        const reader = response.body.getReader();
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          await writer.write(result.value);
        }
      }
      await writer.close();
    } catch (error) {
      await writer.abort(error);
      throw error;
    }
  })();

  context?.waitUntil(pump);
  return stream.readable;
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname !== APK.path) return env.ASSETS.fetch(request);

    if (request.method === "HEAD") {
      return new Response(null, {
        headers: { ...downloadHeaders(), "Content-Length": String(APK.size) },
      });
    }

    if (request.method !== "GET") {
      return new Response("Método não permitido", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    return new Response(streamApk(request, env.ASSETS, context), {
      headers: downloadHeaders(),
    });
  },
};
