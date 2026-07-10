import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const indexPath = join(distDir, "index.html");

async function inlineBuiltAssets() {
  let html = await readFile(indexPath, "utf8");

  html = html.replace(
    /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
    (_, source) => "",
  );

  const scriptMatches = [...(await readFile(indexPath, "utf8")).matchAll(/<script type="module" crossorigin src="([^"]+)"><\/script>/g)];
  for (const [, source] of scriptMatches) {
    const code = await readFile(join(distDir, source.replace(/^\//, "")), "utf8");
    html = html.replace("</body>", `<script type="module">\n${code}\n</script>\n</body>`);
  }

  const styleMatches = [...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g)];
  for (const [tag, source] of styleMatches) {
    const css = await readFile(join(distDir, source.replace(/^\//, "")), "utf8");
    html = html.replace(tag, `<style>\n${css}\n</style>`);
  }

  return html;
}

const indexHtml = await inlineBuiltAssets();

const worker = `const API_URL_KEYS = ["LEITORBI_API_URL", "VITE_API_URL"];
const INDEX_HTML = ${JSON.stringify(indexHtml)};

function withHeaders(response, headers) {
  const nextHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    nextHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

function apiBaseUrl(env) {
  for (const key of API_URL_KEYS) {
    const value = env?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/\\/$/, "");
    }
  }
  return "";
}

async function proxyApi(request, env) {
  const baseUrl = apiBaseUrl(env);
  if (!baseUrl) {
    return Response.json(
      {
        detail:
          "API de producao nao configurada. Defina LEITORBI_API_URL no Sites para habilitar login, demo e analises.",
      },
      { status: 503 },
    );
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, baseUrl);
  const headers = new Headers(request.headers);
  headers.set("host", targetUrl.host);

  return fetch(
    new Request(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    }),
  );
}

async function serveAsset(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" || request.method === "HEAD") {
    if (!url.pathname.startsWith("/assets/")) {
      return new Response(request.method === "HEAD" ? null : INDEX_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
  }

  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) {
    if (url.pathname.startsWith("/assets/")) {
      return withHeaders(response, { "cache-control": "public, max-age=31536000, immutable" });
    }
    return response;
  }

  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return proxyApi(request, env);
    }
    return serveAsset(request, env);
  },
};
`;

const serverDir = join(process.cwd(), "dist", "server");
await mkdir(serverDir, { recursive: true });
await writeFile(join(serverDir, "index.js"), worker);
