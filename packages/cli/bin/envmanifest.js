#!/usr/bin/env node
import("../dist/index.js")
  .then((m) => m.run(process.argv))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
