import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { loadManifest } from "./manifest.js";
import { resolvePolicy, isToolAllowed } from "./policy.js";
import {
  explainRequirement,
  listMissing,
  listRequired,
  resolveSource,
  validate,
  type ToolContext,
} from "./tools.js";

const SERVER_NAME = "envmanifest";
const SERVER_VERSION = "0.1.2";

const TOOL_DEFINITIONS = [
  {
    name: "list_required",
    description:
      "List required env vars / secrets / bindings for a given environment (and optionally service). Returns names + metadata, never values. Sensitive names are redacted by default. When a service declares env_prefix, the returned 'name' is the effective (prefixed) name as the runtime sees it; 'raw_name' and 'prefix' are also included for clarity.",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "Environment name (e.g. 'production', 'local')" },
        service: { type: "string", description: "Optional service filter for monorepos" },
      },
      required: ["env"],
    },
  },
  {
    name: "validate",
    description:
      "Validate that a set of present env-var names satisfies the manifest contract for an environment. Returns missing + forbidden + unknown. Names compared against effective (env_prefix-applied) manifest names.",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string" },
        service: { type: "string" },
        presentNames: { type: "array", items: { type: "string" } },
      },
      required: ["env", "presentNames"],
    },
  },
  {
    name: "explain_requirement",
    description:
      "Explain a single resource: kind, exposure, phase, type, deprecation, rotation, tags. Accepts the effective (prefixed) name, the raw manifest name, or any alias. Returns both 'name' (effective) and 'raw_name' / 'prefix' when a service env_prefix applies.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "resolve_source",
    description:
      "Where does this resource get its value in a given environment? Returns provider + optional ref. Never returns the value itself.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        env: { type: "string" },
      },
      required: ["name", "env"],
    },
  },
  {
    name: "list_missing",
    description:
      "Convenience: list which required names are missing from a presentNames list, for a given env.",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string" },
        service: { type: "string" },
        presentNames: { type: "array", items: { type: "string" } },
      },
      required: ["env", "presentNames"],
    },
  },
] as const;

const ListRequiredZ = z.object({ env: z.string(), service: z.string().optional() });
const ValidateZ = z.object({
  env: z.string(),
  service: z.string().optional(),
  presentNames: z.array(z.string()),
});
const ExplainZ = z.object({ name: z.string() });
const ResolveSourceZ = z.object({ name: z.string(), env: z.string() });

export async function startServer(opts: { cwd: string }): Promise<void> {
  const initialManifest = await loadManifest(opts.cwd);
  let warmCtx: ToolContext | null = null;
  if (initialManifest) {
    warmCtx = {
      manifest: initialManifest,
      policy: resolvePolicy(initialManifest),
    };
  } else {
    console.error(
      `envmanifest-mcp: no manifest.yml found at ${opts.cwd}. ` +
        `Server is starting anyway; tool calls will fail until you 'envmanifest init' or run from a directory with a manifest.`,
    );
  }

  async function getCtx(): Promise<ToolContext | { error: string }> {
    if (warmCtx) return warmCtx;
    const manifest = await loadManifest(opts.cwd);
    if (!manifest) {
      return {
        error: `no manifest.yml found at ${opts.cwd}. Run 'envmanifest init' first, or launch the MCP server from a project that has one.`,
      };
    }
    warmCtx = { manifest, policy: resolvePolicy(manifest) };
    return warmCtx;
  }

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const policy = warmCtx?.policy ?? resolvePolicy(null);
    const tools = TOOL_DEFINITIONS.filter((t) =>
      isToolAllowed(policy, t.name),
    );
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const ctxOrError = await getCtx();
    if ("error" in ctxOrError) {
      return errorResult(ctxOrError.error);
    }
    const ctx = ctxOrError;
    if (!isToolAllowed(ctx.policy, name)) {
      return errorResult(`tool '${name}' is not allowed by current MCP policy`);
    }

    try {
      switch (name) {
        case "list_required": {
          const a = ListRequiredZ.parse(args ?? {});
          return jsonResult(listRequired(ctx, a));
        }
        case "validate": {
          const a = ValidateZ.parse(args ?? {});
          return jsonResult(validate(ctx, a));
        }
        case "explain_requirement": {
          const a = ExplainZ.parse(args ?? {});
          return jsonResult(explainRequirement(ctx, a));
        }
        case "resolve_source": {
          const a = ResolveSourceZ.parse(args ?? {});
          return jsonResult(resolveSource(ctx, a));
        }
        case "list_missing": {
          const a = ValidateZ.parse(args ?? {});
          return jsonResult(listMissing(ctx, a));
        }
        default:
          return errorResult(`unknown tool '${name}'`);
      }
    } catch (err) {
      return errorResult(
        err instanceof Error ? err.message : String(err),
      );
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function jsonResult(data: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
