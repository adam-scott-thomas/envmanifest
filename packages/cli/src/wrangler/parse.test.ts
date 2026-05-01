import { describe, expect, it } from "vitest";
import { extractBindings } from "./parse.js";

describe("extractBindings", () => {
  it("extracts r2_buckets", () => {
    const out = extractBindings({
      r2_buckets: [{ binding: "ASSETS", bucket_name: "my-bucket" }],
    });
    expect(out).toEqual([
      {
        name: "ASSETS",
        provider: "cloudflare-r2",
        resource_type: "bucket",
        resource_id: "my-bucket",
      },
    ]);
  });

  it("extracts d1_databases", () => {
    const out = extractBindings({
      d1_databases: [
        { binding: "DB", database_name: "prod", database_id: "abc-123" },
      ],
    });
    expect(out[0]).toMatchObject({
      name: "DB",
      provider: "cloudflare-d1",
      resource_type: "database",
      resource_id: "abc-123",
    });
  });

  it("extracts kv_namespaces", () => {
    const out = extractBindings({
      kv_namespaces: [{ binding: "SESSIONS", id: "abc" }],
    });
    expect(out[0]?.provider).toBe("cloudflare-kv");
  });

  it("extracts queue producers (queues.producers[])", () => {
    const out = extractBindings({
      queues: {
        producers: [{ binding: "JOBS", queue: "jobs-prod" }],
      },
    });
    expect(out[0]?.provider).toBe("cloudflare-queues");
    expect(out[0]?.resource_id).toBe("jobs-prod");
  });

  it("extracts durable_objects.bindings", () => {
    const out = extractBindings({
      durable_objects: {
        bindings: [{ name: "ROOMS", class_name: "Room" }],
      },
    });
    expect(out[0]).toMatchObject({
      name: "ROOMS",
      provider: "cloudflare-durable-objects",
      resource_id: "Room",
    });
  });

  it("extracts ai binding", () => {
    const out = extractBindings({ ai: { binding: "AI" } });
    expect(out[0]).toMatchObject({
      name: "AI",
      provider: "cloudflare-ai",
    });
  });

  it("extracts services binding", () => {
    const out = extractBindings({
      services: [{ binding: "AUTH_SVC", service: "auth-worker" }],
    });
    expect(out[0]).toMatchObject({
      name: "AUTH_SVC",
      provider: "cloudflare-service",
      resource_id: "auth-worker",
    });
  });

  it("extracts multiple binding types and sorts by name", () => {
    const out = extractBindings({
      r2_buckets: [{ binding: "ZULU", bucket_name: "z" }],
      kv_namespaces: [{ binding: "ALPHA", id: "a" }],
    });
    expect(out.map((b) => b.name)).toEqual(["ALPHA", "ZULU"]);
  });

  it("ignores unknown sections", () => {
    const out = extractBindings({
      name: "my-worker",
      compatibility_date: "2024-01-01",
      vars: { FOO: "bar" },
    });
    expect(out).toEqual([]);
  });

  it("ignores entries without a 'binding' field", () => {
    const out = extractBindings({
      r2_buckets: [{ bucket_name: "stale" }],
    });
    expect(out).toEqual([]);
  });

  it("handles vectorize index bindings", () => {
    const out = extractBindings({
      vectorize: [{ binding: "EMBEDDINGS", index_name: "my-index" }],
    });
    expect(out[0]?.provider).toBe("cloudflare-vectorize");
  });

  it("handles hyperdrive bindings", () => {
    const out = extractBindings({
      hyperdrive: [{ binding: "PG", id: "abc" }],
    });
    expect(out[0]?.provider).toBe("cloudflare-hyperdrive");
  });
});
