import kleur from "kleur";
import { loadManifest, ManifestNotFoundError } from "../manifest/load.js";

interface ExplainOptions {
  cwd: string;
  manifest?: string;
}

export async function explainCommand(
  opts: ExplainOptions,
  name: string,
): Promise<void> {
  if (!name) {
    console.error(kleur.red("✗ usage: envmanifest explain <NAME>"));
    process.exitCode = 1;
    return;
  }

  let loaded;
  try {
    loaded = await loadManifest(opts.cwd, opts.manifest);
  } catch (err) {
    if (err instanceof ManifestNotFoundError) {
      console.error(kleur.red("✗ no manifest.yml found"));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const resource = (loaded.manifest.resources ?? []).find(
    (r) => r.name === name || r.alias?.includes(name),
  );

  if (!resource) {
    console.error(kleur.red(`✗ ${name}: not declared in manifest`));
    process.exitCode = 1;
    return;
  }

  console.log(kleur.bold(resource.name));
  if (resource.alias?.length) {
    console.log(kleur.dim(`  aliases:     ${resource.alias.join(", ")}`));
  }
  console.log(kleur.dim(`  kind:        ${resource.kind}`));
  console.log(kleur.dim(`  exposure:    ${resource.exposure}`));
  console.log(kleur.dim(`  phase:       [${resource.phase.join(", ")}]`));
  if (resource.type) console.log(kleur.dim(`  type:        ${resource.type}`));
  console.log(
    kleur.dim(`  envs:        [${resource.environments.join(", ")}]`),
  );
  if (resource.required === false)
    console.log(kleur.dim(`  required:    false`));
  if (resource.platform_generated)
    console.log(kleur.dim(`  injected by platform — not user-supplied`));
  if (resource.deprecated) {
    const note =
      typeof resource.deprecated === "string" ? resource.deprecated : "yes";
    console.log(kleur.yellow(`  deprecated:  ${note}`));
  }
  if (resource.deprecated_after)
    console.log(kleur.yellow(`  deprecated_after: ${resource.deprecated_after}`));
  if (resource.rotate_every)
    console.log(kleur.dim(`  rotate_every: ${resource.rotate_every}`));
  if (resource.tags?.length)
    console.log(kleur.dim(`  tags:        ${resource.tags.join(", ")}`));

  if (resource.description) {
    console.log();
    for (const line of resource.description.split("\n")) {
      console.log(`  ${line}`);
    }
  }

  if (resource.binding) {
    console.log();
    console.log(kleur.bold("  binding"));
    console.log(kleur.dim(`    provider:      ${resource.binding.provider}`));
    console.log(kleur.dim(`    resource_type: ${resource.binding.resource_type}`));
    console.log(kleur.dim(`    resource_id:   ${resource.binding.resource_id}`));
    if (resource.binding.permissions?.length) {
      console.log(
        kleur.dim(`    permissions:   [${resource.binding.permissions.join(", ")}]`),
      );
    }
  }

  if (resource.sources?.length) {
    console.log();
    console.log(kleur.bold("  sources"));
    for (const s of resource.sources) {
      const envs = s.environments?.length
        ? ` (${s.environments.join(", ")})`
        : "";
      const ref = s.ref ? ` — ${s.ref}` : "";
      console.log(kleur.dim(`    ${s.provider}${envs}${ref}`));
    }
  }

  if (resource.never_in?.length) {
    console.log();
    console.log(
      kleur.yellow(`  never_in: [${resource.never_in.join(", ")}]`),
    );
  }
}
