interface DoctorOptions {
  cwd: string;
}

export async function doctorCommand(opts: DoctorOptions): Promise<void> {
  void opts;
  console.log("envmanifest doctor — not yet implemented (week 2)");
  process.exitCode = 1;
}
