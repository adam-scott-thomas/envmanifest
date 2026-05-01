import type { Finding } from "../manifest/reconcile.js";

interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note";
  message: { text: string };
  locations?: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
    };
  }>;
}

interface SarifRule {
  id: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  defaultConfiguration?: { level: "error" | "warning" | "note" };
}

const RULES: Record<string, SarifRule> = {
  "code.undeclared": {
    id: "code.undeclared",
    shortDescription: {
      text: "Env var referenced in code but not declared in manifest",
    },
    fullDescription: {
      text: "Code reads an env var that is missing from manifest.yml. Either declare the resource or remove the reference.",
    },
    defaultConfiguration: { level: "error" },
  },
  "dotenv.undeclared": {
    id: "dotenv.undeclared",
    shortDescription: {
      text: "Env var present in .env but not declared in manifest",
    },
    fullDescription: {
      text: "A .env file sets a name not listed in manifest.yml. Either declare it or remove it from .env.",
    },
    defaultConfiguration: { level: "warning" },
  },
  "dotenv.missing": {
    id: "dotenv.missing",
    shortDescription: {
      text: "Required env var missing from .env in dev/local",
    },
    fullDescription: {
      text: "The manifest requires this resource for the active environment but no .env file provides it.",
    },
    defaultConfiguration: { level: "error" },
  },
  "policy.forbidden": {
    id: "policy.forbidden",
    shortDescription: {
      text: "Env var present in an environment that the manifest forbids",
    },
    fullDescription: {
      text: "Manifest's never_in policy forbids this resource in the active environment.",
    },
    defaultConfiguration: { level: "error" },
  },
  "manifest.unused": {
    id: "manifest.unused",
    shortDescription: { text: "Manifest entry not referenced in code" },
    fullDescription: {
      text: "A resource is declared in manifest.yml but no code reference exists. Likely stale.",
    },
    defaultConfiguration: { level: "note" },
  },
  "binding.missing": {
    id: "binding.missing",
    shortDescription: {
      text: "Binding declared in manifest but missing from wrangler config",
    },
    fullDescription: {
      text: "A kind:binding resource exists in the manifest but no matching binding is declared in wrangler.toml/wrangler.jsonc.",
    },
    defaultConfiguration: { level: "warning" },
  },
  "binding.undeclared": {
    id: "binding.undeclared",
    shortDescription: {
      text: "Wrangler binding not declared in manifest",
    },
    fullDescription: {
      text: "A binding exists in wrangler.toml/wrangler.jsonc but no matching kind:binding resource exists in manifest.yml.",
    },
    defaultConfiguration: { level: "warning" },
  },
};

export interface RenderSarifOptions {
  findings: Finding[];
  toolVersion: string;
}

export function renderSarif(opts: RenderSarifOptions): string {
  const usedRuleIds = Array.from(new Set(opts.findings.map((f) => f.code)));
  const usedRules = usedRuleIds
    .map((id) => RULES[id])
    .filter((r): r is SarifRule => Boolean(r));

  const results: SarifResult[] = opts.findings.map((f) => ({
    ruleId: f.code,
    level: severityToSarif(f.severity),
    message: { text: f.name ? `${f.name}: ${f.message}` : f.message },
  }));

  const sarif = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "envmanifest",
            informationUri: "https://github.com/adam-scott-thomas/envmanifest",
            version: opts.toolVersion,
            rules: usedRules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

function severityToSarif(s: Finding["severity"]): "error" | "warning" | "note" {
  if (s === "error") return "error";
  if (s === "warning") return "warning";
  return "note";
}
