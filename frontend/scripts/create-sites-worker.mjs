import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const worker = `const API_URL_KEYS = ["LEITORBI_API_URL", "VITE_API_URL"];

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
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/assets/")) {
      return withHeaders(response, { "cache-control": "public, max-age=31536000, immutable" });
    }
    return response;
  }

  const indexUrl = new URL("/index.html", request.url);
  return env.ASSETS.fetch(new Request(indexUrl, request));
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
