import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { parse as parseToml } from "smol-toml";

export type WranglerProvider =
  | "cloudflare-r2"
  | "cloudflare-d1"
  | "cloudflare-kv"
  | "cloudflare-queues"
  | "cloudflare-durable-objects"
  | "cloudflare-ai"
  | "cloudflare-service"
  | "cloudflare-vectorize"
  | "cloudflare-hyperdrive"
  | "cloudflare-analytics-engine";

export interface WranglerBinding {
  name: string;
  provider: WranglerProvider;
  resource_type: string;
  resource_id?: string;
}

export interface WranglerConfig {
  path: string;
  format: "toml" | "jsonc";
  bindings: WranglerBinding[];
}

const CANDIDATES = [
  { name: "wrangler.toml", format: "toml" as const },
  { name: "wrangler.jsonc", format: "jsonc" as const },
  { name: "wrangler.json", format: "jsonc" as const },
];

export async function loadWranglerConfig(cwd: string): Promise<WranglerConfig | null> {
  for (const c of CANDIDATES) {
    const full = join(cwd, c.name);
    try {
      const text = await readFile(full, "utf8");
      const data =
        c.format === "toml"
          ? (parseToml(text) as Record<string, unknown>)
          : (parseJsonc(text) as Record<string, unknown>);
      return {
        path: full,
        format: c.format,
        bindings: extractBindings(data),
      };
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "ENOENT"
      ) {
        continue;
      }
      throw err;
    }
  }
  return null;
}

interface BindingExtractor {
  key: string;
  provider: WranglerProvider;
  resource_type: string;
  bindingNameField?: string;
  resourceIdField?: string;
}

const EXTRACTORS: BindingExtractor[] = [
  { key: "r2_buckets", provider: "cloudflare-r2", resource_type: "bucket", resourceIdField: "bucket_name" },
  { key: "d1_databases", provider: "cloudflare-d1", resource_type: "database", resourceIdField: "database_id" },
  { key: "kv_namespaces", provider: "cloudflare-kv", resource_type: "namespace", resourceIdField: "id" },
  { key: "vectorize", provider: "cloudflare-vectorize", resource_type: "index", resourceIdField: "index_name" },
  { key: "hyperdrive", provider: "cloudflare-hyperdrive", resource_type: "config", resourceIdField: "id" },
  { key: "analytics_engine_datasets", provider: "cloudflare-analytics-engine", resource_type: "dataset", resourceIdField: "dataset" },
  { key: "services", provider: "cloudflare-service", resource_type: "service", resourceIdField: "service" },
];

export function extractBindings(config: Record<string, unknown>): WranglerBinding[] {
  const bindings: WranglerBinding[] = [];

  for (const ex of EXTRACTORS) {
    const list = config[ex.key];
    if (Array.isArray(list)) {
      for (const item of list) {
        const binding = extractStandard(item, ex);
        if (binding) bindings.push(binding);
      }
    }
  }

  // Queue producers: nested under queues.producers
  const queuesConfig = config["queues"];
  if (queuesConfig && typeof queuesConfig === "object" && !Array.isArray(queuesConfig)) {
    const producers = (queuesConfig as { producers?: unknown }).producers;
    if (Array.isArray(producers)) {
      for (const item of producers) {
        if (item && typeof item === "object" && "binding" in item) {
          const name = (item as { binding: unknown }).binding;
          const queueName = (item as { queue?: unknown }).queue;
          if (typeof name === "string") {
            const out: WranglerBinding = {
              name,
              provider: "cloudflare-queues",
              resource_type: "queue",
            };
            if (typeof queueName === "string") out.resource_id = queueName;
            bindings.push(out);
          }
        }
      }
    }
  }

  // Durable Objects: nested under durable_objects.bindings
  const doConfig = config["durable_objects"];
  if (doConfig && typeof doConfig === "object" && "bindings" in doConfig) {
    const list = (doConfig as { bindings: unknown }).bindings;
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && typeof item === "object" && "name" in item) {
          const name = (item as { name: unknown }).name;
          const className = (item as { class_name?: unknown }).class_name;
          if (typeof name === "string") {
            const out: WranglerBinding = {
              name,
              provider: "cloudflare-durable-objects",
              resource_type: "object",
            };
            if (typeof className === "string") out.resource_id = className;
            bindings.push(out);
          }
        }
      }
    }
  }

  // AI binding (single): { ai: { binding: "AI" } }
  const aiConfig = config["ai"];
  if (aiConfig && typeof aiConfig === "object" && "binding" in aiConfig) {
    const name = (aiConfig as { binding: unknown }).binding;
    if (typeof name === "string") {
      bindings.push({
        name,
        provider: "cloudflare-ai",
        resource_type: "model_binding",
      });
    }
  }

  // Static Assets: { assets: { binding: "ASSETS", directory: "..." } }
  const assetsConfig = config["assets"];
  if (assetsConfig && typeof assetsConfig === "object" && "binding" in assetsConfig) {
    const name = (assetsConfig as { binding: unknown }).binding;
    if (typeof name === "string") {
      bindings.push({
        name,
        provider: "cloudflare-r2",
        resource_type: "static-assets",
      });
    }
  }

  // Sort for stable output
  bindings.sort((a, b) => a.name.localeCompare(b.name));
  return bindings;
}

function extractStandard(
  item: unknown,
  ex: BindingExtractor,
): WranglerBinding | null {
  if (!item || typeof item !== "object") return null;
  const rec = item as Record<string, unknown>;
  const name = rec["binding"];
  if (typeof name !== "string") return null;
  const out: WranglerBinding = {
    name,
    provider: ex.provider,
    resource_type: ex.resource_type,
  };
  if (ex.resourceIdField) {
    const id = rec[ex.resourceIdField];
    if (typeof id === "string") out.resource_id = id;
  }
  return out;
}
