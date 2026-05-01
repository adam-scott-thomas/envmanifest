interface ScanOptions {
  cwd: string;
  explain?: boolean;
}

export async function scanCommand(opts: ScanOptions): Promise<void> {
  void opts;
  console.log("envmanifest scan — not yet implemented (week 1)");
  process.exitCode = 1;
}
