interface ExampleOptions {
  cwd: string;
  env: string;
  out: string;
}

export async function exampleCommand(opts: ExampleOptions): Promise<void> {
  void opts;
  console.log("envmanifest example — not yet implemented (week 2)");
  process.exitCode = 1;
}
