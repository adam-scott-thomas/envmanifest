import schemaV0 from "@envmanifest/schema/manifest.schema.v0.json" with { type: "json" };

const SCHEMA_V0_JSON = JSON.stringify(schemaV0);
const SCHEMA_V0_ETAG = `"v0-${hashLength(SCHEMA_V0_JSON)}"`;

const PLACEHOLDER_SEAL_PUBLIC_KEY =
  "# envmanifest seal public key\n" +
  "# This file will hold the ed25519 public key once L1+ signed seals ship (Phase 2).\n" +
  "# Until then, this endpoint exists so verify-seal clients can probe it without a 404.\n";

interface RouteHandler {
  pattern: RegExp;
  handle: (request: Request, url: URL) => Response | Promise<Response>;
}

const ROUTES: RouteHandler[] = [
  {
    pattern: /^\/schemas\/v0\/manifest\.schema\.json\/?$/,
    handle: () => json(SCHEMA_V0_JSON, SCHEMA_V0_ETAG),
  },
  {
    pattern: /^\/\.well-known\/seal-public-key\/?$/,
    handle: () =>
      new Response(PLACEHOLDER_SEAL_PUBLIC_KEY, {
        status: 200,
        headers: corsHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      }),
  },
  {
    pattern: /^\/health\/?$/,
    handle: () =>
      new Response("ok\n", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
  },
  {
    pattern: /^\/?$/,
    handle: () =>
      new Response(LANDING_HTML, {
        status: 200,
        headers: corsHeaders({ "Content-Type": "text/html; charset=utf-8" }),
      }),
  },
];

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS" },
      });
    }

    for (const route of ROUTES) {
      if (route.pattern.test(url.pathname)) {
        const ifNoneMatch = request.headers.get("If-None-Match");
        if (
          ifNoneMatch === SCHEMA_V0_ETAG &&
          url.pathname.startsWith("/schemas/v0/")
        ) {
          return new Response(null, { status: 304, headers: corsHeaders() });
        }
        return route.handle(request, url);
      }
    }

    return new Response("not found", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  },
};

function json(body: string, etag: string): Response {
  return new Response(body, {
    status: 200,
    headers: corsHeaders({
      "Content-Type": "application/schema+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=86400",
      ETag: etag,
    }),
  });
}

function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
    ...extra,
  };
}

function hashLength(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>env.ghostlogic.tech — envmanifest schemas</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-width: 720px; margin: 4rem auto; padding: 0 1.25rem; line-height: 1.5; color: #1a1a1a; }
  h1 { font-size: 1.4rem; letter-spacing: -0.01em; }
  code { background: #f3f3f3; padding: 0.1em 0.35em; border-radius: 3px; font-size: 0.95em; }
  pre { background: #f7f7f7; padding: 0.9rem 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.9rem; }
  ul { padding-left: 1.2rem; }
  a { color: #5333ed; }
  .muted { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>env.ghostlogic.tech</h1>
<p>Hosting endpoints for the <strong><a href="https://github.com/adam-scott-thomas/envmanifest">envmanifest</a></strong> contract.</p>

<h2>Endpoints</h2>
<ul>
  <li><code>GET /schemas/v0/manifest.schema.json</code> — JSON Schema for v0 manifests</li>
  <li><code>GET /.well-known/seal-public-key</code> — placeholder for the L1+ signing key (Phase 2)</li>
  <li><code>GET /health</code> — uptime probe</li>
</ul>

<h2>Use in your manifest</h2>
<pre>
# yaml-language-server: $schema=https://env.ghostlogic.tech/schemas/v0/manifest.schema.json

version: 0
project: my-app
environments: [local, production]
resources: []
</pre>

<p class="muted">Schema is currently <code>v0</code>, experimental. Locks at <code>v1</code> after real-world contact with major frameworks and providers.</p>
</body>
</html>
`;
