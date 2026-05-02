import { describe, expect, it } from "vitest";
import { detectPrefixGroups } from "./draft.js";

describe("detectPrefixGroups", () => {
  it("returns no groups when no prefix patterns appear", () => {
    const { groups, ungrouped } = detectPrefixGroups([
      "DATABASE_URL",
      "API_KEY",
      "PORT",
    ]);
    expect(groups).toEqual([]);
    expect(ungrouped.sort()).toEqual(["API_KEY", "DATABASE_URL", "PORT"]);
  });

  it("groups NEXT_PUBLIC_* even at count 1 (known public prefix)", () => {
    const { groups, ungrouped } = detectPrefixGroups(["NEXT_PUBLIC_APP_URL"]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.prefix).toBe("NEXT_PUBLIC_");
    expect(groups[0]?.serviceName).toBe("web");
    expect(groups[0]?.unprefixedNames).toEqual(["APP_URL"]);
    expect(ungrouped).toEqual([]);
  });

  it("groups VITE_* under service 'web'", () => {
    const { groups } = detectPrefixGroups([
      "VITE_API_URL",
      "VITE_TITLE",
      "DATABASE_URL",
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.prefix).toBe("VITE_");
    expect(groups[0]?.serviceName).toBe("web");
    expect(groups[0]?.unprefixedNames.sort()).toEqual(["API_URL", "TITLE"]);
  });

  it("auto-detects custom prefix at threshold 3", () => {
    const { groups, ungrouped } = detectPrefixGroups([
      "POAW_DATABASE_URL",
      "POAW_API_KEY",
      "POAW_LOG_LEVEL",
      "DATABASE_URL", // not POAW_, stays ungrouped
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.prefix).toBe("POAW_");
    expect(groups[0]?.serviceName).toBe("poaw");
    expect(ungrouped).toEqual(["DATABASE_URL"]);
  });

  it("does NOT auto-detect a prefix shared by only 2 names", () => {
    const { groups, ungrouped } = detectPrefixGroups([
      "POAW_FOO",
      "POAW_BAR",
      "DATABASE_URL",
    ]);
    expect(groups).toEqual([]);
    expect(ungrouped.sort()).toEqual(["DATABASE_URL", "POAW_BAR", "POAW_FOO"]);
  });

  it("prefers the longer prefix when both qualify", () => {
    // Both NEXT_ (4 names) and NEXT_PUBLIC_ (3 names) hit threshold;
    // NEXT_PUBLIC_ is longer + better-known and should win for those 3.
    // The 4th name NEXT_TELEMETRY stays under shorter NEXT_ — but NEXT_ alone
    // has only 1 unclaimed left after NEXT_PUBLIC_ claims its 3, so it
    // shouldn't form a group.
    const { groups } = detectPrefixGroups([
      "NEXT_PUBLIC_A",
      "NEXT_PUBLIC_B",
      "NEXT_PUBLIC_C",
      "NEXT_TELEMETRY",
    ]);
    const nextPublic = groups.find((g) => g.prefix === "NEXT_PUBLIC_");
    expect(nextPublic).toBeDefined();
    expect(nextPublic?.unprefixedNames.sort()).toEqual(["A", "B", "C"]);
    // NEXT_TELEMETRY ends up ungrouped (single member of NEXT_ family).
  });

  it("handles a multi-prefix manifest with both public web and server prefixes", () => {
    const { groups, ungrouped } = detectPrefixGroups([
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "POAW_DATABASE_URL",
      "POAW_API_KEY",
      "POAW_LOG_LEVEL",
      "PORT",
    ]);
    expect(groups).toHaveLength(2);
    const web = groups.find((g) => g.serviceName === "web");
    const poaw = groups.find((g) => g.serviceName === "poaw");
    expect(web?.unprefixedNames.length).toBe(2);
    expect(poaw?.unprefixedNames.length).toBe(3);
    expect(ungrouped).toEqual(["PORT"]);
  });
});
