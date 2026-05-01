#!/usr/bin/env node
import("../dist/index.js")
  .then((m) => m.startServer({ cwd: process.cwd() }))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
