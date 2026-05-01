interface InitOptions {
  cwd: string;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  void opts;
  console.log("envmanifest init — not yet implemented (week 1)");
  process.exitCode = 1;
}
