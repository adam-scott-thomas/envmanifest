import { SCHEMA_V0 } from "./generated/schema-v0.js";

const SCHEMA_V0_JSON = JSON.stringify(SCHEMA_V0);
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
<title>envmanifest — config contract layer for AI-assisted software</title>
<meta name="description" content="Declare your app's config once. Reconcile across code, .env files, CI, and deployed providers. Free CLI, MCP server for coding agents, signed config attestations.">
<style>
  :root { color-scheme: light; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 760px; margin: 3rem auto 6rem; padding: 0 1.25rem; line-height: 1.55; color: #14141a; }
  h1 { font-size: 1.85rem; letter-spacing: -0.02em; margin-bottom: 0.25rem; }
  h1 small { display: block; font-weight: 400; font-size: 0.95rem; color: #666; margin-top: 0.25rem; letter-spacing: 0; }
  h2 { font-size: 1.15rem; letter-spacing: -0.01em; margin-top: 2.4rem; margin-bottom: 0.5rem; }
  p { margin: 0.6rem 0; }
  code { background: #f2f2f5; padding: 0.1em 0.4em; border-radius: 4px; font-size: 0.9em; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  pre { background: #faf9f7; border: 1px solid #ececef; padding: 0.95rem 1.1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; line-height: 1.45; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  ul { padding-left: 1.25rem; }
  li { margin: 0.25rem 0; }
  a { color: #5333ed; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .muted { color: #666; font-size: 0.9rem; }
  .badge { display: inline-block; background: #fff5d6; border: 1px solid #ecd778; color: #6b4f00; padding: 0.1em 0.55em; border-radius: 3px; font-size: 0.78em; font-weight: 500; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1rem; }
  @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
  hr { border: 0; border-top: 1px solid #ececef; margin: 2.5rem 0; }
</style>
</head>
<body>

<h1>envmanifest <span class="badge">v0.1</span>
  <small>The config contract layer for AI-assisted software delivery.</small>
</h1>

<p>Declare your app's config once. Reconcile it across code, <code>.env</code> files, CI, and deployed providers. Free CLI for local checks. MCP server for coding agents. Verifiable attestations of what was actually deployed.</p>

<h2>Install</h2>
<pre>npm install -g envmanifest</pre>

<h2>30-second quickstart</h2>
<pre>cd your-project
envmanifest init        # scan code, draft manifest.yml
envmanifest doctor      # plain-English status
envmanifest check       # CI-shaped reconcile</pre>

<h2>Use the schema in your editor</h2>
<p>Pin this at the top of your <code>manifest.yml</code> — VS Code's YAML extension and JetBrains JSON Schema support both pick it up:</p>
<pre># yaml-language-server: $schema=https://env.ghostlogic.tech/schemas/v0/manifest.schema.json

version: 0
project: my-app
environments: [local, production]
resources: []
</pre>

<h2>For coding agents (MCP)</h2>
<p>Local MCP server exposes the manifest to Claude Code / Cursor / any MCP-aware agent — names + metadata only, never values. Default-deny on mutating tools.</p>
<pre>npm install -g @envmanifest/mcp-local
claude mcp add envmanifest --scope user -- envmanifest-mcp</pre>

<h2>For CI (GitHub Action)</h2>
<pre>- uses: adam-scott-thomas/envmanifest/actions/check@v0.1.1
  with:
    environment: production
    format: sarif</pre>

<hr>

<div class="grid">
<div>
  <h2 style="margin-top: 0;">v0.1 scope</h2>
  <ul>
    <li>JavaScript / TypeScript scanner</li>
    <li>Service-level <code>env_prefix</code> (NEXT_PUBLIC_, VITE_, custom)</li>
    <li>Cloudflare <code>wrangler.toml</code> / <code>.jsonc</code> binding parser</li>
    <li>L0 unsigned + in-toto Statement reports</li>
    <li>Local MCP server</li>
    <li>GitHub Action with SARIF</li>
  </ul>
</div>
<div>
  <h2 style="margin-top: 0;">v0.2 (~2 weeks)</h2>
  <ul>
    <li>Python scanner (stdlib + pydantic-settings)</li>
    <li>Dotenv fallback when scanner is empty</li>
    <li>Multi-component repo / <code>workspace.yml</code></li>
    <li>Multi-env file precedence rules</li>
  </ul>
</div>
</div>

<h2>Endpoints on this domain</h2>
<ul>
  <li><a href="/schemas/v0/manifest.schema.json"><code>GET /schemas/v0/manifest.schema.json</code></a> — JSON Schema for <code>v0</code> manifests</li>
  <li><a href="/.well-known/seal-public-key"><code>GET /.well-known/seal-public-key</code></a> — placeholder for the L1+ signing key (Phase 2)</li>
  <li><a href="/health"><code>GET /health</code></a> — uptime probe</li>
</ul>

<h2>Source &amp; license</h2>
<ul>
  <li><a href="https://github.com/adam-scott-thomas/envmanifest">github.com/adam-scott-thomas/envmanifest</a></li>
  <li>MIT for OSS components (CLI, runtime, MCP local, schema). Cloud adapters BSL 1.1 → Apache 2.0 after 2 years (Phase 2).</li>
  <li><a href="https://github.com/adam-scott-thomas/envmanifest/blob/main/docs/v0.2-plan.md">Roadmap</a> · <a href="https://github.com/adam-scott-thomas/envmanifest/issues">Issues</a></li>
</ul>

<p class="muted" style="margin-top: 3rem;">Schema is currently <code>v0</code>, experimental. Locks at <code>v1</code> after real-world contact with major frameworks and providers (target: 6 months or 100 active users).</p>

</body>
</html>
`;
