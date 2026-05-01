interface CheckOptions {
  cwd: string;
  env: string;
}

export async function checkCommand(opts: CheckOptions): Promise<void> {
  void opts;
  console.log("envmanifest check — not yet implemented (week 1)");
  process.exitCode = 1;
}
